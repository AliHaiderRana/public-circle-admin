import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requireSuperAdminSession, toAdminAuditSession, verifyAdminPassword } from '@/lib/auth';
import {
  logAdminActivity,
  ADMIN_AUDIT_ACTION,
  ADMIN_AUDIT_CATEGORY,
} from '@/lib/admin-audit';
import { performArchivedCompanyDeletion } from '@/lib/company-archive.server';

/**
 * POST /api/companies/archived/[id]/delete
 * Super-admin only. Permanently deletes an archived company: removes its
 * backed-up S3 files (if any), deletes the ARCHIVED company stub document,
 * and deletes the ArchivedCompany record — no data is recoverable
 * afterward. Requires the caller to re-enter their own admin password, same
 * as archive/restore.
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
    const result = await performArchivedCompanyDeletion(id);

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.ARCHIVED_COMPANY_DELETE,
        category: ADMIN_AUDIT_CATEGORY.COMPANY,
        resourceType: 'archived_company',
        resourceId: id,
        details: {
          companyName: result.companyName,
          awsBackupObjectsDeleted: result.awsBackupObjectsDeleted,
          companyDocDeleted: result.companyDocDeleted,
        },
      });
    }

    return NextResponse.json({
      message: `Company "${result.companyName}" permanently deleted`,
      data: result,
    });
  } catch (err) {
    console.error('Error deleting archived company:', err);
    const message = err instanceof Error ? err.message : 'Failed to delete company';
    const status = message === 'Archived company record not found' ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
