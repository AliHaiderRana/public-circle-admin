import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Company from '@/lib/models/Company';
import { getServerSession } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const companySize = searchParams.get('companySize') || '';
    const country = searchParams.get('country') || '';
    const status = searchParams.get('status') || '';
    const city = searchParams.get('city') || '';
    const sort = searchParams.get('sort') || 'desc';

    // Build search query
    let query: any = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
        { country: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } },
        { postalCode: { $regex: search, $options: 'i' } },
        { companySize: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (companySize) {
      query.companySize = companySize;
    }
    
    if (country) {
      query.country = country;
    }
    
    if (city) {
      query.city = city;
    }
    
    if (status) {
      query.status = status;
    }
    
    const skip = (page - 1) * limit;
    const sortOrder = sort === 'asc' ? 1 : -1;
    
    const [companies, totalCount, distinctCountries, distinctSizes, distinctCities] = await Promise.all([
      Company.find(query)
        .sort({ createdAt: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      Company.countDocuments(query),
      Company.distinct('country'),
      Company.distinct('companySize'),
      Company.distinct('city')
    ]);

    // Convert ObjectId to string for consistent comparison
    const formattedCompanies = companies.map(company => ({
      ...company,
      _id: company._id.toString()
    }));

    return NextResponse.json({
      companies: formattedCompanies,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      },
      filters: {
        countries: distinctCountries.filter(Boolean).sort(),
        sizes: distinctSizes.filter(Boolean).sort(),
        cities: distinctCities.filter(Boolean).sort()
      }
    });
  } catch (error: any) {
    console.error('Error fetching companies:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch companies',
      details: error.message 
    }, { status: 500 });
  }
}
