import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requireSuperAdminSession, toAdminAuditSession, verifyAdminPassword } from '@/lib/auth';
import {
  logAdminActivity,
  ADMIN_AUDIT_ACTION,
  ADMIN_AUDIT_CATEGORY,
} from '@/lib/admin-audit';
import { performCompanyArchive } from '@/lib/company-archive.server';

/**
 * POST /api/companies/[id]/archive
 * Super-admin only. Backs up the company's MongoDB documents and S3 files to
 * AWS_BACKUP_BUCKET, then pauses its Stripe subscriptions and removes the
 * live DB/S3 data — recoverable later via /api/companies/archived/[id]/restore.
 * Requires the caller to re-enter their own admin password, same as delete.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireSuperAdminSession();
  if (error) return error;

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid company ID' }, { status: 400 });
  }

  let password: string;
  try {
    const body = await request.json();
    password = typeof body?.password === 'string' ? body.password : '';
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!password) {
    return NextResponse.json({ error: 'Your password is required' }, { status: 400 });
  }

  if (!(await verifyAdminPassword(session.email, password))) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  try {
    const result = await performCompanyArchive(id, session.email);

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.COMPANY_ARCHIVE,
        category: ADMIN_AUDIT_CATEGORY.COMPANY,
        resourceType: 'company',
        resourceId: id,
        details: {
          companyName: result.companyName,
          archivedCompanyId: result.archivedCompanyId,
          backupPrefix: result.backupPrefix,
          dbBackedUpDocuments: result.db.backedUpDocuments,
          dbDeletedDocuments: result.db.deletedDocuments,
          awsBackedUpObjects: result.aws.backedUpObjects,
          awsBackedUpBytes: result.aws.backedUpBytes,
          awsDeletedObjects: result.aws.deletedObjects,
          awsErrors: result.aws.errors,
          stripeSubscriptionsPaused: result.stripe.paused,
          stripeErrors: result.stripe.errors,
        },
      });
    }

    return NextResponse.json({
      message: `Company "${result.companyName}" archived`,
      data: result,
    });
  } catch (err) {
    console.error('Error archiving company:', err);
    const message = err instanceof Error ? err.message : 'Failed to archive company';
    const status = message === 'Company not found' ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
