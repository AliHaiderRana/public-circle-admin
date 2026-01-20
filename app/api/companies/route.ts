import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Company from '@/lib/models/Company';
import Campaign from '@/lib/models/Campaign';
import CompanyContact from '@/lib/models/CompanyContact';
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
    const sortBy = searchParams.get('sortBy') || 'createdAt';

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
    
    // First, get all companies matching the query (without pagination) to calculate counts
    const [allCompanies, totalCount, distinctCountries, distinctSizes, distinctCities] = await Promise.all([
      Company.find(query).lean(),
      Company.countDocuments(query),
      Company.distinct('country'),
      Company.distinct('companySize'),
      Company.distinct('city')
    ]);

    // Get company IDs to fetch counts
    const companyIds = allCompanies.map(c => c._id);
    
    // Fetch campaign counts for all companies
    const campaignCounts = await Campaign.aggregate([
      { $match: { company: { $in: companyIds } } },
      { $group: { _id: '$company', count: { $sum: 1 } } }
    ]);
    
    // Fetch contact counts for all companies
    const contactCounts = await CompanyContact.aggregate([
      { $match: { public_circles_company: { $in: companyIds } } },
      { $group: { _id: '$public_circles_company', count: { $sum: 1 } } }
    ]);
    
    // Create maps for easy lookup
    const campaignCountMap = new Map();
    const contactCountMap = new Map();
    
    campaignCounts.forEach(item => {
      campaignCountMap.set(item._id.toString(), item.count);
    });
    
    contactCounts.forEach(item => {
      contactCountMap.set(item._id.toString(), item.count);
    });

    // Convert ObjectId to string for consistent comparison and add counts
    const formattedCompanies = allCompanies.map(company => {
      const companyId = company._id.toString();
      return {
        ...company,
        _id: companyId,
        campaignCount: campaignCountMap.get(companyId) || 0,
        contactCount: contactCountMap.get(companyId) || 0
      };
    });

    // Sort by the requested field
    let sortedCompanies = formattedCompanies;
    if (sortBy === 'campaignCount' || sortBy === 'contactCount') {
      sortedCompanies = formattedCompanies.sort((a, b) => {
        const aValue = a[sortBy] || 0;
        const bValue = b[sortBy] || 0;
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      });
    } else {
      // For other fields, use MongoDB sort
      sortedCompanies = formattedCompanies.sort((a, b) => {
        const aValue = a[sortBy] || '';
        const bValue = b[sortBy] || '';
        if (sortBy === 'createdAt') {
          const aDate = new Date(aValue).getTime();
          const bDate = new Date(bValue).getTime();
          return sortOrder === 'asc' ? aDate - bDate : bDate - aDate;
        }
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortOrder === 'asc' 
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }
        return sortOrder === 'asc' ? (aValue > bValue ? 1 : -1) : (aValue < bValue ? 1 : -1);
      });
    }

    // Apply pagination after sorting
    const companies = sortedCompanies.slice(skip, skip + limit);

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
