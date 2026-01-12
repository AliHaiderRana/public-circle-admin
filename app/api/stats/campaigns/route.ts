import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import CustomerRequest from '@/lib/models/CustomerRequest';
import Campaign from '@/lib/models/Campaign';
import { CUSTOMER_REQUEST_STATUS } from '@/lib/constants';
import { getServerSession } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  try {
    const [pendingRequests, completedRequests, rejectedRequests, activeCampaigns, totalCampaigns, recentActivity] = await Promise.all([
      CustomerRequest.countDocuments({ requestStatus: CUSTOMER_REQUEST_STATUS.PENDING }),
      CustomerRequest.countDocuments({ requestStatus: CUSTOMER_REQUEST_STATUS.COMPLETED }),
      CustomerRequest.countDocuments({ requestStatus: CUSTOMER_REQUEST_STATUS.REJECTED }),
      Campaign.countDocuments({ status: 'ACTIVE' }),
      Campaign.countDocuments({}),
      Campaign.find({ status: 'ACTIVE' })
        .populate('company', 'name')
        .sort({ createdAt: -1 })
        .limit(5)
    ]);

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
