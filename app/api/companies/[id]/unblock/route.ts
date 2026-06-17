import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Company from '@/lib/models/Company';
import User from '@/lib/models/User';
import { getServerSession, toAdminAuditSession } from '@/lib/auth';
import {
  logAdminActivity,
  ADMIN_AUDIT_ACTION,
  ADMIN_AUDIT_CATEGORY,
} from '@/lib/admin-audit';
import { runWithOptionalTransaction } from '@/lib/run-with-optional-transaction';
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

    await dbConnect();

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

    const companyObjectId = new mongoose.Types.ObjectId(id);

    const { usersUnblocked } = await runWithOptionalTransaction(async (dbSession) => {
      const sessionOpts = dbSession ? { session: dbSession } : {};

      await Company.findByIdAndUpdate(
        id,
        { status: USER_STATUS.ACTIVE },
        sessionOpts
      );

      const usersUpdateResult = await User.updateMany(
        {
          company: companyObjectId,
          status: USER_STATUS.BLOCKED,
        },
        { status: USER_STATUS.ACTIVE },
        sessionOpts
      );

      return { usersUnblocked: usersUpdateResult.modifiedCount };
    });

    const auditSession = toAdminAuditSession(session);
    if (!auditSession) {
      console.warn('[admin-audit] Skipped company unblock audit — missing admin session identity');
    } else {
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.COMPANY_UNBLOCK,
        category: ADMIN_AUDIT_CATEGORY.COMPANY,
        resourceType: 'company',
        resourceId: id,
        details: {
          companyName: company.name,
          usersUnblocked,
        },
      });
    }

    return NextResponse.json({
      message: 'Company unblocked successfully',
      data: {
        companyId: id,
        usersUnblocked,
      },
    });
  } catch (error) {
    console.error('Error unblocking company:', error);
    return NextResponse.json(
      { error: 'Failed to unblock company' },
      { status: 500 }
    );
  }
}
