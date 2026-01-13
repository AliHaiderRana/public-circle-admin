import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Company from '@/lib/models/Company';
import User from '@/lib/models/User';
import { getServerSession } from '@/lib/auth';
import { USER_STATUS } from '@/lib/constants';

/**
 * POST /api/companies/[id]/unblock
 * Unblock a company - this will:
 * 1. Set the company status to ACTIVE
 * 2. Set all BLOCKED users of this company to ACTIVE
 * Note: Campaigns remain paused - admin can manually activate them if needed
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

    if (company.status !== USER_STATUS.BLOCKED) {
      return NextResponse.json(
        { error: 'Company is not blocked!' },
        { status: 400 }
      );
    }

    // Start a session for transaction
    const dbSession = await mongoose.startSession();
    dbSession.startTransaction();

    try {
      // 1. Unblock the company
      await Company.findByIdAndUpdate(
        id,
        { status: USER_STATUS.ACTIVE },
        { session: dbSession }
      );

      // 2. Unblock all blocked users of this company
      const usersUpdateResult = await User.updateMany(
        { 
          company: new mongoose.Types.ObjectId(id),
          status: USER_STATUS.BLOCKED 
        },
        { status: USER_STATUS.ACTIVE },
        { session: dbSession }
      );

      await dbSession.commitTransaction();

      return NextResponse.json({
        message: 'Company unblocked successfully',
        data: {
          companyId: id,
          usersUnblocked: usersUpdateResult.modifiedCount,
        },
      });
    } catch (error) {
      await dbSession.abortTransaction();
      throw error;
    } finally {
      dbSession.endSession();
    }
  } catch (error) {
    console.error('Error unblocking company:', error);
    return NextResponse.json(
      { error: 'Failed to unblock company' },
      { status: 500 }
    );
  }
}
