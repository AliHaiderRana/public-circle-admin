import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Campaign from '@/lib/models/Campaign';
import Company from '@/lib/models/Company';
import CampaignRun from '@/lib/models/CampaignRun';
import EmailsSent from '@/lib/models/EmailsSent';
import { getServerSession, toAdminAuditSession } from '@/lib/auth';
import { isPartnerSession, canPartnerAccessCompany } from '@/lib/partner-access.util';
import { logPartnerPortalActivity, PARTNER_PORTAL_ACTIONS } from '@/lib/partner-activity';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  try {
    const { id } = await params;
    console.log('Fetching campaign with ID:', id);
    
    // Validate ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      console.log('Invalid ObjectId format:', id);
      return NextResponse.json({ error: 'Invalid campaign ID format' }, { status: 400 });
    }
    
    const campaign = await Campaign.findById(id)
      .populate('company', 'name')
      .lean();

    console.log('Campaign found:', !!campaign);

    if (!campaign) {
      // Try to find any campaigns to debug
      const allCampaigns = await Campaign.find({}).limit(5).select('_id campaignName').lean();
      console.log('Available campaigns:', allCampaigns);
      
      return NextResponse.json({ 
        error: 'Campaign not found',
        requestedId: id,
        availableCampaigns: allCampaigns
      }, { status: 404 });
    }

    const campaignCompanyId =
      typeof campaign.company === 'object' && campaign.company !== null && '_id' in campaign.company
        ? String((campaign.company as { _id: unknown })._id)
        : String(campaign.company);

    if (isPartnerSession(session)) {
      const allowed = await canPartnerAccessCompany(session, campaignCompanyId);
      if (!allowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Fetch campaign runs count and bounce/complaint totals for this campaign
    const campaignRunIds = (
      await CampaignRun.find({ campaign: id }).select('_id').lean()
    ).map((run) => run._id);
    const [campaignRunsCount, emailStats] = await Promise.all([
      Promise.resolve(campaignRunIds.length),
      campaignRunIds.length
        ? EmailsSent.aggregate<{
            bounceCount: number;
            complaintCount: number;
          }>([
            { $match: { campaignRun: { $in: campaignRunIds } } },
            {
              $group: {
                _id: null,
                bounceCount: {
                  $sum: {
                    $cond: [{ $ifNull: ['$emailEvents.Bounce', false] }, 1, 0],
                  },
                },
                complaintCount: {
                  $sum: {
                    $cond: [{ $ifNull: ['$emailEvents.Complaint', false] }, 1, 0],
                  },
                },
              },
            },
          ])
        : Promise.resolve([]),
    ]);
    const bounceCount = emailStats[0]?.bounceCount || 0;
    const complaintCount = emailStats[0]?.complaintCount || 0;

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logPartnerPortalActivity(auditSession, {
        action: PARTNER_PORTAL_ACTIONS.VIEW_CAMPAIGN,
        resourceType: 'campaign',
        resourceId: id,
        details: {
          campaignId: id,
          companyId: campaignCompanyId,
          campaignName: campaign.campaignName,
          emailSubject: campaign.emailSubject,
        },
        summary: `Partner viewed campaign ${campaign.campaignName || id}`,
      });
    }

    return NextResponse.json({ 
      campaign: {
        ...campaign,
        campaignRunsCount,
        bounceCount,
        complaintCount,
      }
    });
  } catch (error) {
    console.error('Error fetching campaign details:', error);
    return NextResponse.json({ error: 'Failed to fetch campaign details' }, { status: 500 });
  }
}
