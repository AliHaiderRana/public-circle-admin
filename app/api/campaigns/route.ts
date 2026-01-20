import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Campaign from '@/lib/models/Campaign';
import Company from '@/lib/models/Company';
import CampaignRun from '@/lib/models/CampaignRun';
import EmailsSent from '@/lib/models/EmailsSent';
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
    const sort = searchParams.get('sort') || 'desc';

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
    const sortOrder = sort === 'asc' ? 1 : -1;
    
    const [campaigns, totalCount] = await Promise.all([
      Campaign.find(query)
        .populate('company', 'name')
        .sort({ createdAt: sortOrder })
        .skip(skip)
        .limit(limit),
      Campaign.countDocuments(query)
    ]);
    
    // Fetch campaign runs for all campaigns
    const campaignIds = campaigns.map(c => c._id);
    const campaignRuns = await CampaignRun.find({
      campaign: { $in: campaignIds }
    })
      .populate('campaign', 'campaignName')
      .sort({ createdAt: -1 });
    
    // Get email counts for campaign runs
    const campaignRunIds = campaignRuns.map(run => run._id);
    const emailCounts = await EmailsSent.aggregate([
      { $match: { campaignRun: { $in: campaignRunIds } } },
      {
        $group: {
          _id: '$campaignRun',
          totalCount: { $sum: 1 }
        }
      }
    ]);
    
    // Create maps for easy lookup
    const campaignRunsMap = new Map();
    const emailCountMap = new Map();
    
    campaignRuns.forEach(run => {
      // Handle both populated and unpopulated campaign references
      const campaignId = (run.campaign?._id || run.campaign)?.toString();
      if (campaignId) {
        if (!campaignRunsMap.has(campaignId)) {
          campaignRunsMap.set(campaignId, []);
        }
        campaignRunsMap.get(campaignId).push(run);
      }
    });
    
    emailCounts.forEach(item => {
      emailCountMap.set(item._id.toString(), item.totalCount);
    });
    
    // Add campaign runs to each campaign
    const campaignsWithRuns = campaigns.map(campaign => {
      const campaignId = campaign._id.toString();
      const runs = campaignRunsMap.get(campaignId) || [];
      const runsWithEmailCounts = runs.map((run: any) => ({
        _id: run._id,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        isDataStoredOnWarehouse: run.isDataStoredOnWarehouse,
        emailsSentCount: emailCountMap.get(run._id.toString()) || 0
      }));
      
      return {
        ...campaign.toObject(),
        campaignRuns: runsWithEmailCounts,
        campaignRunsCount: runsWithEmailCounts.length
      };
    });
    
    return NextResponse.json({
      campaigns: campaignsWithRuns,
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
