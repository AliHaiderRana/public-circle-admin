import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requireSuperAdminSession } from '@/lib/auth';
import { getProgress } from '@/lib/archive-progress.server';

/**
 * GET /api/companies/[id]/archive-progress
 * Super-admin only. Polled by the archive/delete modal while its POST
 * request is in flight, to show granular step-by-step progress instead of a
 * static spinner. Returns null once no operation is running for this company.
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

  return NextResponse.json({ data: getProgress(id) });
}
