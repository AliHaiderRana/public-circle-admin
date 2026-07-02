import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import ThirdPartyUser, { THIRD_PARTY_PORTAL_ACCESS } from '@/lib/models/ThirdPartyUser';
import { requireSuperAdminSession, toAdminAuditSession } from '@/lib/auth';
import {
  logAdminActivity,
  ADMIN_AUDIT_ACTION,
  ADMIN_AUDIT_CATEGORY,
} from '@/lib/admin-audit';
import {
  formatReferralRoleLabel,
  formatThirdPartyUserName,
  isReferralSignupComplete,
} from '@/lib/third-party-user-display.util';

const VALID_PORTAL_ACCESS = new Set<string>(Object.values(THIRD_PARTY_PORTAL_ACCESS));

function mapUser(row: Record<string, unknown>) {
  return {
    id: String(row._id),
    referralUserId: String(row.referralUserId),
    emailAddress: row.emailAddress,
    firstName: row.firstName,
    lastName: row.lastName,
    name: formatThirdPartyUserName(row as Parameters<typeof formatThirdPartyUserName>[0]),
    role: row.role,
    roleLabel: formatReferralRoleLabel(String(row.role ?? '')),
    status: row.status,
    signupStep: row.signupStep,
    signupCompleted: isReferralSignupComplete(
      row as Parameters<typeof isReferralSignupComplete>[0],
    ),
    signupCompletedAt: row.signupCompletedAt,
    portalAccess: row.portalAccess,
    country: row.country,
    region: row.region,
    city: row.city,
    address: row.address,
    postalCode: row.postalCode,
    phoneNumber: row.phoneNumber,
    secondaryEmail: row.secondaryEmail,
    currency: row.currency,
    lastSyncedAt: row.lastSyncedAt,
    referralCreatedAt: row.referralCreatedAt,
    referralUpdatedAt: row.referralUpdatedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireSuperAdminSession();
  if (error) return error;

  const { id } = await params;
  await dbConnect();

  const user = await ThirdPartyUser.findById(id).lean();
  if (!user) {
    return NextResponse.json({ error: 'Referral user not found' }, { status: 404 });
  }

  return NextResponse.json({ user: mapUser(user as Record<string, unknown>) });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSuperAdminSession();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const portalAccess =
    typeof body.portalAccess === 'string' ? body.portalAccess.trim() : '';

  if (!portalAccess || !VALID_PORTAL_ACCESS.has(portalAccess)) {
    return NextResponse.json({ error: 'Invalid portal access value' }, { status: 400 });
  }

  await dbConnect();
  const existing = await ThirdPartyUser.findById(id).lean();
  if (!existing) {
    return NextResponse.json({ error: 'Referral user not found' }, { status: 404 });
  }

  const updated = await ThirdPartyUser.findByIdAndUpdate(
    id,
    { $set: { portalAccess } },
    { new: true },
  ).lean();

  const auditSession = toAdminAuditSession(session);
  if (auditSession) {
    await logAdminActivity(auditSession, {
      action: ADMIN_AUDIT_ACTION.SYSTEM_CONFIG_UPDATE,
      category: ADMIN_AUDIT_CATEGORY.SYSTEM_CONFIG,
      resourceType: 'third_party_user',
      resourceId: id,
      details: {
        email: existing.emailAddress,
        name: formatThirdPartyUserName(existing),
        previousPortalAccess: existing.portalAccess,
        portalAccess,
      },
      summary: `Updated referral user portal access for ${formatThirdPartyUserName(existing)} (${existing.emailAddress}) to ${portalAccess}`,
    });
  }

  return NextResponse.json({ user: mapUser(updated as Record<string, unknown>) });
}
