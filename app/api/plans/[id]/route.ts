import { NextResponse } from 'next/server';
import { z } from 'zod';
import dbConnect from '@/lib/db';
import { getServerSession, toAdminAuditSession } from '@/lib/auth';
import {
  logAdminActivity,
  ADMIN_AUDIT_ACTION,
  ADMIN_AUDIT_CATEGORY,
} from '@/lib/admin-audit';
import Plan, { normalizePlanQuota } from '@/lib/models/Plan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId');

const nonNegativeInt = z.coerce.number().int().min(0);

const updatePlanQuotaSchema = z
  .object({
    quota: z
      .object({
        project: nonNegativeInt.optional(),
        email: nonNegativeInt.optional(),
        bandwidth: nonNegativeInt.optional(),
        contact: nonNegativeInt.optional(),
      })
      .refine((value) => Object.keys(value).length > 0, {
        message: 'At least one quota field is required',
      }),
  })
  .strict();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();

  try {
    const { id } = await params;
    if (!objectIdSchema.safeParse(id).success) {
      return NextResponse.json({ error: 'Invalid plan ID' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = updatePlanQuotaSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request payload' },
        { status: 400 }
      );
    }

    const quotaUpdates = parsed.data.quota;
    const existingPlan = await Plan.findById(id).select('name quota').lean();
    const updateDoc: Record<string, number> = {};

    for (const [key, value] of Object.entries(quotaUpdates)) {
      if (value !== undefined) {
        updateDoc[`quota.${key}`] = value;
      }
    }

    const plan = await Plan.findByIdAndUpdate(
      id,
      { $set: updateDoc },
      { new: true, runValidators: true }
    )
      .select('name quota updatedAt')
      .lean();

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.PLAN_QUOTA_UPDATE,
        category: ADMIN_AUDIT_CATEGORY.PLAN,
        resourceType: 'plan',
        resourceId: id,
        details: {
          planName: plan.name,
          previousQuota: existingPlan?.quota
            ? normalizePlanQuota(existingPlan.quota as Record<string, unknown>)
            : null,
          quota: normalizePlanQuota(plan.quota as Record<string, unknown>),
          fieldsChanged: Object.keys(quotaUpdates),
        },
      });
    }

    return NextResponse.json({
      plan: {
        ...plan,
        quota: normalizePlanQuota(plan.quota as Record<string, unknown>),
      },
    });
  } catch (error) {
    console.error('Failed to update plan quota:', error);
    return NextResponse.json({ error: 'Failed to update plan quota' }, { status: 500 });
  }
}
