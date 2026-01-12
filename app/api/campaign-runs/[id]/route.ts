import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import CampaignRun from '@/lib/models/CampaignRun';
import Campaign from '@/lib/models/Campaign';
import Company from '@/lib/models/Company';
import EmailsSent from '@/lib/models/EmailsSent';
import { getServerSession } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const filter = searchParams.get('filter') || '';
    const search = searchParams.get('search') || '';
    const warehouse = searchParams.get('warehouse') === 'true';
    
    const resolvedParams = await params;
    const campaignRunId = resolvedParams.id;
    
    console.log('Fetching campaign run with ID:', campaignRunId);
    
    // Validate ObjectId format
    if (!campaignRunId.match(/^[0-9a-fA-F]{24}$/)) {
      console.log('Invalid ObjectId format:', campaignRunId);
      return NextResponse.json({ error: 'Invalid campaign run ID format' }, { status: 400 });
    }

    // Get campaign run details
    const campaignRun = await CampaignRun.findById(campaignRunId)
      .populate('company', 'name')
      .populate('campaign', 'campaignName emailSubject');

    console.log('Campaign run found:', !!campaignRun);

    if (!campaignRun) {
      // Try to find any campaign runs to debug
      const allCampaignRuns = await CampaignRun.find({}).limit(5).select('_id createdAt').lean();
      console.log('Available campaign runs:', allCampaignRuns);
      
      return NextResponse.json({ 
        error: 'Campaign run not found',
        requestedId: campaignRunId,
        availableCampaignRuns: allCampaignRuns
      }, { status: 404 });
    }

    console.log('Campaign run details:', campaignRun);

    // Get email counts for this campaign run including CC and BCC
    const emailCounts = await EmailsSent.aggregate([
      { $match: { campaignRun: campaignRun._id } },
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
    
    // Create email counts object
    const emailCountsData = emailCounts.length > 0 ? {
      total: emailCounts[0].totalCount,
      to: emailCounts[0].toCount,
      cc: emailCounts[0].ccCount,
      bcc: emailCounts[0].bccCount
    } : { total: 0, to: 0, cc: 0, bcc: 0 };
    
    console.log('Email counts:', emailCountsData);

    // Add email counts to campaign run object
    const campaignRunWithCounts = {
      ...campaignRun.toObject(),
      emailsSentCount: emailCountsData.total,
      emailCounts: emailCountsData
    };

    const eventFieldByFilter: Record<string, string> = {
      emailsSent: 'Send',
      emailsDelivered: 'Delivery',
      emailsFailed: 'Bounce',
      emailsOpened: 'Open',
      emailsClicked: 'Click'
    };

    const toMatch: any = {
      campaignRun: campaignRun._id,
      recipientType: 'TO'
    };

    if (search) {
      toMatch.$or = [
        { toEmailAddress: { $regex: search, $options: 'i' } },
        { emailSubject: { $regex: search, $options: 'i' } }
      ];
    }

    if (filter && eventFieldByFilter[filter]) {
      toMatch[`emailEvents.${eventFieldByFilter[filter]}`] = { $exists: true };
    }

    // Fetch only TO recipients (main rows)
    const emailRecords = await EmailsSent.find(toMatch)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Total for pagination should match table rows (TO recipients)
    const totalEmails = await EmailsSent.countDocuments(toMatch);

    // Attach CC/BCC lists for each TO email using parentToEmailId
    const toIds = emailRecords.map((e: any) => e._id);
    if (toIds.length > 0) {
      const ccBccRows = await EmailsSent.find({
        campaignRun: campaignRun._id,
        parentToEmailId: { $in: toIds },
        recipientType: { $in: ['CC', 'BCC'] }
      })
        .select('parentToEmailId recipientType toEmailAddress')
        .lean();

      const grouped = new Map<string, { cc: string[]; bcc: string[] }>();
      ccBccRows.forEach((row: any) => {
        const key = row.parentToEmailId?.toString();
        if (!key) return;
        const existing = grouped.get(key) || { cc: [], bcc: [] };
        if (row.recipientType === 'CC') existing.cc.push(row.toEmailAddress);
        if (row.recipientType === 'BCC') existing.bcc.push(row.toEmailAddress);
        grouped.set(key, existing);
      });

      emailRecords.forEach((rec: any) => {
        const key = rec._id?.toString();
        const lists = key ? grouped.get(key) : undefined;
        rec.cc = (lists?.cc || []).map((addr) => ({ emailAddress: addr }));
        rec.bcc = (lists?.bcc || []).map((addr) => ({ emailAddress: addr }));
      });
    }

    console.log('Found email records:', emailRecords.length);
    console.log('Total emails:', totalEmails);

    return NextResponse.json({
      campaignRun: campaignRunWithCounts,
      emails: emailRecords,
      pagination: {
        page,
        limit,
        total: totalEmails,
        pages: Math.ceil(totalEmails / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching campaign run details:', error);
    return NextResponse.json({ error: 'Failed to fetch campaign run details' }, { status: 500 });
  }
}
