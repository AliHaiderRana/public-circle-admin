import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Company from '@/lib/models/Company';
import User from '@/lib/models/User';
import Campaign from '@/lib/models/Campaign';
import { getServerSession } from '@/lib/auth';
import { USER_STATUS, CAMPAIGN_STATUS } from '@/lib/constants';

/**
 * POST /api/companies/[id]/block
 * Block a company - this will:
 * 1. Set the company status to BLOCKED
 * 2. Set all users of this company to BLOCKED
 * 3. Pause all active campaigns of this company
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid company ID' },
        { status: 400 }
      );
    }

    // Connect to database if not already connected
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/circles');
    }

    const company = await Company.findById(id);
    if (!company) {
      return NextResponse.json(
        { error: 'Company not found!' },
        { status: 404 }
      );
    }

    if (company.status === USER_STATUS.BLOCKED) {
      return NextResponse.json(
        { error: 'Company is already blocked!' },
        { status: 400 }
      );
    }

    // Start a session for transaction
    const dbSession = await mongoose.startSession();
    dbSession.startTransaction();

    try {
      // 1. Block the company
      await Company.findByIdAndUpdate(
        id,
        { status: USER_STATUS.BLOCKED },
        { session: dbSession }
      );

      // 2. Block all users of this company (except deleted ones)
      const usersUpdateResult = await User.updateMany(
        { 
          company: new mongoose.Types.ObjectId(id),
          status: { $ne: USER_STATUS.DELETED }
        },
        { status: USER_STATUS.BLOCKED },
        { session: dbSession }
      );

      // 3. Pause all active campaigns of this company
      const campaignsUpdateResult = await Campaign.updateMany(
        { 
          company: new mongoose.Types.ObjectId(id),
          status: CAMPAIGN_STATUS.ACTIVE 
        },
        { status: CAMPAIGN_STATUS.PAUSED },
        { session: dbSession }
      );

      await dbSession.commitTransaction();

      return NextResponse.json({
        message: 'Company blocked successfully',
        data: {
          companyId: id,
          usersBlocked: usersUpdateResult.modifiedCount,
          campaignsPaused: campaignsUpdateResult.modifiedCount,
        },
      });
    } catch (error) {
      await dbSession.abortTransaction();
      throw error;
    } finally {
      dbSession.endSession();
    }
  } catch (error) {
    console.error('Error blocking company:', error);
    return NextResponse.json(
      { error: 'Failed to block company' },
      { status: 500 }
    );
  }
}
