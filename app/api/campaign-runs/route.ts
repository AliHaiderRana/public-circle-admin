import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import CampaignRun from '@/lib/models/CampaignRun';
import Campaign from '@/lib/models/Campaign';
import Company from '@/lib/models/Company';
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
    const company = searchParams.get('company') || '';
    const campaign = searchParams.get('campaign') || '';
    const emailCountFilter = searchParams.get('emailCountFilter') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build search query
    let query: any = {};
    
    if (search) {
      query.$or = [
        { 'campaign.campaignName': { $regex: search, $options: 'i' } },
        { 'campaign.emailSubject': { $regex: search, $options: 'i' } },
        { 'company.name': { $regex: search, $options: 'i' } }
      ];
    }
    
    if (company) {
      query.company = company;
    }
    
    if (campaign) {
      query.campaign = campaign;
    }
    
    const skip = (page - 1) * limit;
    
    // Build sort object
    const sortOptions: any = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const [campaignRuns, totalCount] = await Promise.all([
      CampaignRun.find(query)
        .populate('company', 'name')
        .populate('campaign', 'campaignName emailSubject')
        .sort(sortOptions)
        .skip(skip)
        .limit(limit),
      CampaignRun.countDocuments(query)
    ]);
    
    // Get email counts for each campaign run including CC and BCC
    const campaignRunIds = campaignRuns.map(run => run._id);
    const emailCounts = await EmailsSent.aggregate([
      { $match: { campaignRun: { $in: campaignRunIds } } },
      {
        $group: {
          _id: '$campaignRun',
          totalCount: { $sum: 1 },
          toCount: {
            $sum: {
              $cond: [{ $eq: ['$recipientType', 'TO'] }, 1, 0]
            }
          },
          ccCount: {
            $sum: {
              $cond: [{ $eq: ['$recipientType', 'CC'] }, 1, 0]
            }
          },
          bccCount: {
            $sum: {
              $cond: [{ $eq: ['$recipientType', 'BCC'] }, 1, 0]
            }
          }
        }
      }
    ]);
    
    // Create a map of campaign run ID to email counts
    const emailCountMap = new Map();
    emailCounts.forEach(item => {
      emailCountMap.set(item._id.toString(), {
        total: item.totalCount,
        to: item.toCount,
        cc: item.ccCount,
        bcc: item.bccCount
      });
    });
    
    // Add email counts to campaign runs
    const campaignRunsWithEmailCounts = campaignRuns.map(run => ({
      ...run.toObject(),
      emailsSentCount: emailCountMap.get(run._id.toString())?.total || 0,
      emailCounts: emailCountMap.get(run._id.toString()) || { total: 0, to: 0, cc: 0, bcc: 0 }
    }));
    
    // Apply email count filter
    let filteredCampaignRuns = campaignRunsWithEmailCounts;
    if (emailCountFilter) {
      filteredCampaignRuns = campaignRunsWithEmailCounts.filter(run => {
        const count = run.emailsSentCount;
        switch (emailCountFilter) {
          case '0':
            return count === 0;
          case '1-10':
            return count >= 1 && count <= 10;
          case '11-100':
            return count >= 11 && count <= 100;
          case '101-1000':
            return count >= 101 && count <= 1000;
          case '1000+':
            return count >= 1000;
          default:
            return true;
        }
      });
    }
    
    // Update pagination for filtered results
    const filteredTotal = filteredCampaignRuns.length;
    const filteredSkip = (page - 1) * limit;
    const paginatedResults = filteredCampaignRuns.slice(filteredSkip, filteredSkip + limit);
    
    return NextResponse.json({
      campaignRuns: paginatedResults,
      pagination: {
        page,
        limit,
        total: filteredTotal,
        pages: Math.ceil(filteredTotal / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching campaign runs:', error);
    return NextResponse.json({ error: 'Failed to fetch campaign runs' }, { status: 500 });
  }
}
