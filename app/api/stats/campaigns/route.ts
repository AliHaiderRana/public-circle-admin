import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import CustomerRequest from '@/lib/models/CustomerRequest';
import Campaign from '@/lib/models/Campaign';
import CampaignRun from '@/lib/models/CampaignRun';
import User from '@/lib/models/User';
import { CUSTOMER_REQUEST_STATUS } from '@/lib/constants';
import { getServerSession } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  try {
    const [pendingRequests, completedRequests, rejectedRequests, activeCampaigns, totalCampaigns, recentCampaignRuns, recentRequests, recentUsers] = await Promise.all([
      CustomerRequest.countDocuments({ requestStatus: CUSTOMER_REQUEST_STATUS.PENDING }),
      CustomerRequest.countDocuments({ requestStatus: CUSTOMER_REQUEST_STATUS.COMPLETED }),
      CustomerRequest.countDocuments({ requestStatus: CUSTOMER_REQUEST_STATUS.REJECTED }),
      Campaign.countDocuments({ status: 'ACTIVE' }),
      Campaign.countDocuments({}),
      CampaignRun.find({})
        .populate('campaign', 'campaignName')
        .populate('company', 'name')
        .sort({ createdAt: -1 })
        .limit(3),
      CustomerRequest.find({})
        .populate('companyId', 'name')
        .sort({ createdAt: -1 })
        .limit(3),
      User.find({})
        .populate('company', 'name')
        .sort({ createdAt: -1 })
        .limit(2)
    ]);

    const recentActivity = [
      ...recentCampaignRuns.map(run => ({
        _id: run._id,
        type: 'campaign_run',
        name: run.campaign?.campaignName || 'Campaign Run',
        company: run.company,
        status: run.status,
        emailsSent: run.emailsSent,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt
      })),
      ...recentRequests.map(req => ({
        _id: req._id,
        type: 'customer_request',
        name: req.type,
        company: req.companyId,
        status: req.requestStatus,
        createdAt: req.createdAt,
        updatedAt: req.updatedAt
      })),
      ...recentUsers.map(user => ({
        _id: user._id,
        type: 'user_registration',
        name: user.email,
        company: user.company,
        status: 'ACTIVE',
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }))
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);

    return NextResponse.json({
      pendingRequests,
      completedRequests,
      rejectedRequests,
      activeCampaigns,
      totalCampaigns,
      recentActivity
    });
  } catch (error) {
    console.error('Error fetching campaign stats:', error);
    return NextResponse.json({ error: 'Failed to fetch campaign stats' }, { status: 500 });
  }
}
