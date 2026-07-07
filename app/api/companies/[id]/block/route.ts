import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Company from '@/lib/models/Company';
import User from '@/lib/models/User';
import Campaign from '@/lib/models/Campaign';
import { getServerSession, toAdminAuditSession } from '@/lib/auth';
import { isPartnerSession } from '@/lib/partner-access.util';
import {
  logAdminActivity,
  ADMIN_AUDIT_ACTION,
  ADMIN_AUDIT_CATEGORY,
} from '@/lib/admin-audit';
import { runWithOptionalTransaction } from '@/lib/run-with-optional-transaction';
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
    if (isPartnerSession(session)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

    if (company.status === USER_STATUS.BLOCKED) {
      return NextResponse.json(
        { error: 'Company is already blocked!' },
        { status: 400 }
      );
    }

    const companyObjectId = new mongoose.Types.ObjectId(id);

    const { usersBlocked, campaignsPaused } = await runWithOptionalTransaction(
      async (dbSession) => {
        const sessionOpts = dbSession ? { session: dbSession } : {};

        await Company.findByIdAndUpdate(
          id,
          { status: USER_STATUS.BLOCKED },
          sessionOpts
        );

        const usersUpdateResult = await User.updateMany(
          {
            company: companyObjectId,
            status: { $ne: USER_STATUS.DELETED },
          },
          { status: USER_STATUS.BLOCKED },
          sessionOpts
        );

        const campaignsUpdateResult = await Campaign.updateMany(
          {
            company: companyObjectId,
            status: CAMPAIGN_STATUS.ACTIVE,
          },
          { status: CAMPAIGN_STATUS.PAUSED },
          sessionOpts
        );

        return {
          usersBlocked: usersUpdateResult.modifiedCount,
          campaignsPaused: campaignsUpdateResult.modifiedCount,
        };
      }
    );

    const auditSession = toAdminAuditSession(session);
    if (!auditSession) {
      console.warn('[admin-audit] Skipped company block audit — missing admin session identity');
    } else {
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.COMPANY_BLOCK,
        category: ADMIN_AUDIT_CATEGORY.COMPANY,
        resourceType: 'company',
        resourceId: id,
        details: {
          companyName: company.name,
          usersBlocked,
          campaignsPaused,
        },
      });
    }

    return NextResponse.json({
      message: 'Company blocked successfully',
      data: {
        companyId: id,
        usersBlocked,
        campaignsPaused,
      },
    });
  } catch (error) {
    console.error('Error blocking company:', error);
    return NextResponse.json(
      { error: 'Failed to block company' },
      { status: 500 }
    );
  }
}
