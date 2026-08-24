import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requireSuperAdminSession, toAdminAuditSession, verifyAdminPassword } from '@/lib/auth';
import {
  logAdminActivity,
  ADMIN_AUDIT_ACTION,
  ADMIN_AUDIT_CATEGORY,
} from '@/lib/admin-audit';
import { performCompanyDeletion } from '@/lib/company-deletion.server';

/**
 * POST /api/companies/[id]/delete
 * Super-admin only. Permanently deletes a company: cancels its Stripe
 * subscriptions, deletes its S3 objects, then deletes every MongoDB document
 * that references it. Irreversible. Requires the caller to re-enter their
 * own admin password (re-authentication before an irreversible action),
 * checked server-side behind the admin UI's own confirmation safeguard.
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
    const result = await performCompanyDeletion(id);

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.COMPANY_DELETE,
        category: ADMIN_AUDIT_CATEGORY.COMPANY,
        resourceType: 'company',
        resourceId: id,
        details: {
          companyName: result.companyName,
          dbDocumentsDeleted: result.db.deletedDocuments,
          dbCollectionsAffected: result.db.deletedCollections,
          awsObjectsDeleted: result.aws.deletedObjects,
          awsBytesDeleted: result.aws.deletedBytes,
          awsErrors: result.aws.errors,
          stripeSubscriptionsCancelled: result.stripe.cancelled,
          stripeErrors: result.stripe.errors,
        },
      });
    }

    return NextResponse.json({
      message: `Company "${result.companyName}" permanently deleted`,
      data: result,
    });
  } catch (err) {
    console.error('Error deleting company:', err);
    const message = err instanceof Error ? err.message : 'Failed to delete company';
    const status = message === 'Company not found' ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
