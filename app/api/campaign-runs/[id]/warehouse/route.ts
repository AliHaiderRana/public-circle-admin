import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import CampaignRun from '@/lib/models/CampaignRun';
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
    
    const resolvedParams = await params;
    const campaignRunId = resolvedParams.id;
    
    console.log('Fetching warehouse emails for campaign run:', campaignRunId);
    
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
    console.log('Is data stored on warehouse:', campaignRun?.isDataStoredOnWarehouse);

    if (!campaignRun) {
      return NextResponse.json({ error: 'Campaign run not found' }, { status: 404 });
    }

    if (!campaignRun.isDataStoredOnWarehouse) {
      return NextResponse.json({ error: 'Campaign run data is not stored in warehouse' }, { status: 400 });
    }

    // For now, return empty data since warehouse endpoint requires server connection
    // In a real implementation, this would fetch from data warehouse
    return NextResponse.json({
      items: [],
      totalRecords: 0,
      campaignRun: {
        _id: campaignRun._id,
        company: campaignRun.company,
        campaign: campaignRun.campaign,
        isDataStoredOnWarehouse: campaignRun.isDataStoredOnWarehouse,
        createdAt: campaignRun.createdAt,
        updatedAt: campaignRun.updatedAt
      }
    });
  } catch (error) {
    console.error('Error fetching warehouse data:', error);
    return NextResponse.json({ error: 'Failed to fetch warehouse data' }, { status: 500 });
  }
}
