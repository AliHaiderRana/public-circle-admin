import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requireSuperAdminSession, toAdminAuditSession, verifyAdminPassword } from '@/lib/auth';
import {
  logAdminActivity,
  ADMIN_AUDIT_ACTION,
  ADMIN_AUDIT_CATEGORY,
} from '@/lib/admin-audit';
import { performCompanyRestore } from '@/lib/company-archive.server';

/**
 * POST /api/companies/archived/[id]/restore
 * Super-admin only. Restores an archived company: re-inserts its MongoDB
 * documents, copies its S3 files back, and resumes its paused Stripe
 * subscription(s) (same subscription ids, no new charge). Requires the
 * caller to re-enter their own admin password, same as archive/delete.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireSuperAdminSession();
  if (error) return error;

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid archived company ID' }, { status: 400 });
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
    const result = await performCompanyRestore(id, session.email);

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.COMPANY_RESTORE,
        category: ADMIN_AUDIT_CATEGORY.COMPANY,
        resourceType: 'archived_company',
        resourceId: id,
        details: {
          companyName: result.companyName,
          dbRestoredDocuments: result.db.restoredDocuments,
          dbRestoredCollections: result.db.restoredCollections,
          awsRestoredObjects: result.aws.restoredObjects,
          awsErrors: result.aws.errors,
          stripeSubscriptionsResumed: result.stripe.resumedSubscriptions,
          stripeErrors: result.stripe.errors,
        },
      });
    }

    const hadErrors = result.aws.errors.length > 0 || result.stripe.errors.length > 0;
    return NextResponse.json({
      message: hadErrors
        ? `Company "${result.companyName}" partially restored — some steps need attention`
        : `Company "${result.companyName}" restored`,
      data: result,
    });
  } catch (err) {
    console.error('Error restoring company:', err);
    const message = err instanceof Error ? err.message : 'Failed to restore company';
    const status = message === 'Archived company record not found' ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
