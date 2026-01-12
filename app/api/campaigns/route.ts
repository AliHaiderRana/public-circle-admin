import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Campaign from '@/lib/models/Campaign';
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
    const status = searchParams.get('status') || '';
    const company = searchParams.get('company') || '';

    // Ensure Company model is registered for populate
    const _Company = Company;
    
    // Build search query
    let query: any = {};
    
    if (search) {
      query.$or = [
        { campaignName: { $regex: search, $options: 'i' } },
        { emailSubject: { $regex: search, $options: 'i' } },
        { sourceEmailAddress: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) {
      query.status = status;
    }
    
    if (company) {
      query.company = company;
    }
    
    const skip = (page - 1) * limit;
    
    const [campaigns, totalCount] = await Promise.all([
      Campaign.find(query)
        .populate('company', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Campaign.countDocuments(query)
    ]);
    
    return NextResponse.json({
      campaigns,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
  }
}
