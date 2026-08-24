import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requireSuperAdminSession } from '@/lib/auth';
import { getCompanyDeletionPreview } from '@/lib/company-deletion.server';

/**
 * GET /api/companies/[id]/deletion-preview
 * Super-admin only. Pulls the company's DB footprint, S3 usage, and
 * cancelable Stripe subscriptions so the admin can see exactly what a
 * permanent delete would remove before confirming it.
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
    const preview = await getCompanyDeletionPreview(id);
    return NextResponse.json({ data: preview });
  } catch (err) {
    console.error('Error building company deletion preview:', err);
    const message = err instanceof Error ? err.message : 'Failed to load deletion preview';
    const status = message === 'Company not found' ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
