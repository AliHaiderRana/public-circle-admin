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
    const companyFilter = searchParams.get('company') || '';
    const campaignFilter = searchParams.get('campaign') || '';
    const emailCountFilter = searchParams.get('emailCountFilter') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build search query
    let query: any = {};

    // Search by campaign name or company name - need to find matching IDs first
    if (search) {
      const [matchingCampaigns, matchingCompanies] = await Promise.all([
        Campaign.find({
          $or: [
            { campaignName: { $regex: search, $options: 'i' } },
            { emailSubject: { $regex: search, $options: 'i' } }
          ]
        }).select('_id'),
        Company.find({ name: { $regex: search, $options: 'i' } }).select('_id')
      ]);

      const campaignIds = matchingCampaigns.map(c => c._id);
      const companyIds = matchingCompanies.map(c => c._id);

      query.$or = [
        { campaign: { $in: campaignIds } },
        { company: { $in: companyIds } }
      ];
    }

    // Filter by company - handle both ID and name
    if (companyFilter) {
      // Check if it's a valid ObjectId (24 hex characters)
      if (companyFilter.match(/^[0-9a-fA-F]{24}$/)) {
        // It's an ID, use it directly
        query.company = companyFilter;
      } else {
        // It's a name, find matching company IDs
        const matchingCompanies = await Company.find({
          name: { $regex: `^${companyFilter}$`, $options: 'i' }
        }).select('_id');
        const companyIds = matchingCompanies.map(c => c._id);
        if (companyIds.length > 0) {
          query.company = { $in: companyIds };
        } else {
          // No matching companies, return empty result
          query.company = { $in: [] };
        }
      }
    }

    // Filter by campaign - handle both ID and name
    if (campaignFilter) {
      // Check if it's a valid ObjectId (24 hex characters)
      if (campaignFilter.match(/^[0-9a-fA-F]{24}$/)) {
        // It's an ID, use it directly
        query.campaign = campaignFilter;
      } else {
        // It's a name, find matching campaign IDs
        const matchingCampaigns = await Campaign.find({
          campaignName: { $regex: `^${campaignFilter}$`, $options: 'i' }
        }).select('_id');
        const campaignIds = matchingCampaigns.map(c => c._id);
        if (campaignIds.length > 0) {
          query.campaign = { $in: campaignIds };
        } else {
          // No matching campaigns, return empty result
          query.campaign = { $in: [] };
        }
      }
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
    
    // Calculate the correct total based on whether email count filter is applied
    // When email filter is applied, we need to count filtered results
    // When no email filter, use the database count
    const actualTotal = emailCountFilter ? filteredCampaignRuns.length : totalCount;
    const paginatedResults = emailCountFilter
      ? filteredCampaignRuns.slice((page - 1) * limit, (page - 1) * limit + limit)
      : campaignRunsWithEmailCounts;

    // Get all unique companies and campaigns that have campaign runs for filter dropdowns
    const [uniqueCompanyIds, uniqueCampaignIds] = await Promise.all([
      CampaignRun.distinct('company'),
      CampaignRun.distinct('campaign')
    ]);

    const [allCompanies, allCampaigns] = await Promise.all([
      Company.find({ _id: { $in: uniqueCompanyIds } }).select('name').sort({ name: 1 }),
      Campaign.find({ _id: { $in: uniqueCampaignIds } }).select('campaignName').sort({ campaignName: 1 })
    ]);

    // Deduplicate company and campaign names
    const uniqueCompanyNames = [...new Set(allCompanies.map(c => c.name).filter(Boolean))].sort();
    const uniqueCampaignNames = [...new Set(allCampaigns.map(c => c.campaignName).filter(Boolean))].sort();

    return NextResponse.json({
      campaignRuns: paginatedResults,
      pagination: {
        page,
        limit,
        total: actualTotal,
        pages: Math.ceil(actualTotal / limit)
      },
      filters: {
        companies: uniqueCompanyNames,
        campaigns: uniqueCampaignNames
      }
    });
  } catch (error) {
    console.error('Error fetching campaign runs:', error);
    return NextResponse.json({ error: 'Failed to fetch campaign runs' }, { status: 500 });
  }
}
