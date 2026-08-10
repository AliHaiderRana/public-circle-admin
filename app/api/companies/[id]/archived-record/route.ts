import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requireSuperAdminSession } from '@/lib/auth';
import { getActiveArchiveRecord } from '@/lib/company-archive.server';

/**
 * GET /api/companies/[id]/archived-record
 * Super-admin only. Returns the active (not-yet-restored) archive record for
 * this company, or null — powers the Restore action on the company detail
 * page when its status is ARCHIVED.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireSuperAdminSession();
  if (error) return error;

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid company ID' }, { status: 400 });
  }

  try {
    const record = await getActiveArchiveRecord(id);
    return NextResponse.json({ data: record });
  } catch (err) {
    console.error('Error fetching archive record:', err);
    return NextResponse.json({ error: 'Failed to fetch archive record' }, { status: 500 });
  }
}
