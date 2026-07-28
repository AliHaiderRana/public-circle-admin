import { NextResponse } from 'next/server';
import { requireSuperAdminSession } from '@/lib/auth';
import { getArchivedCompanies } from '@/lib/company-archive.server';

/**
 * GET /api/companies/archived
 * Super-admin only. Lists archived companies (backed up + removed via
 * Archive) so an admin can find one to restore.
 */
export async function GET() {
  const { error } = await requireSuperAdminSession();
  if (error) return error;

  try {
    const archived = await getArchivedCompanies();
    return NextResponse.json({ data: archived });
  } catch (err) {
    console.error('Error listing archived companies:', err);
    return NextResponse.json({ error: 'Failed to list archived companies' }, { status: 500 });
  }
}
