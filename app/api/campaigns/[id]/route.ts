import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Campaign from '@/lib/models/Campaign';
import Company from '@/lib/models/Company';
import CampaignRun from '@/lib/models/CampaignRun';
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

    // Fetch campaign runs count for this campaign
    const campaignRunsCount = await CampaignRun.countDocuments({ campaign: id });

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
        campaignRunsCount
      }
    });
  } catch (error) {
    console.error('Error fetching campaign details:', error);
    return NextResponse.json({ error: 'Failed to fetch campaign details' }, { status: 500 });
  }
}
