import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/db';
import AdminUser from '@/lib/models/AdminUser';
import type { AdminAuditSession } from '@/lib/admin-audit.constants';
import { ADMIN_JWT_SECRET } from '@/lib/admin-jwt';
import { isPartnerSession } from '@/lib/partner-access.util';
import { getReferralPartnerById } from '@/lib/referral-partner.service';
import { isPartnerHandoffEnabled } from '@/lib/partner-handoff-settings.server';

function readBearerToken(request?: Request): string | null {
  if (!request) return null;
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice('Bearer '.length).trim();
  return token || null;
}

export async function getServerSession(request?: Request) {
  try {
    const cookieStore = await cookies();
    const token =
      cookieStore.get('admin_token')?.value || readBearerToken(request);

    if (!token) return null;

    const decoded = jwt.verify(token, ADMIN_JWT_SECRET) as any;

    if (decoded.isPartner && decoded.referralUserId) {
      if (!(await isPartnerHandoffEnabled())) {
        return null;
      }

      const partner = await getReferralPartnerById(String(decoded.referralUserId));
      if (!partner) {
        return null;
      }

      return {
        ...decoded,
        userId: String(partner._id),
        email: partner.emailAddress,
        name: [partner.firstName, partner.lastName].filter(Boolean).join(' ') || partner.emailAddress,
        isSuperAdmin: false,
        isPartner: true,
        referralUserId: String(partner._id),
        referralRole: partner.role,
      };
    }
    
    // Verify user still exists in database (prevents deleted users from accessing)
    await dbConnect();
    const user = await AdminUser.findOne({ email: decoded.email }).select('_id email name isSuperAdmin');
    
    if (!user) {
      return null; // User was deleted, invalidate session
    }
    
    return {
      ...decoded,
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      isSuperAdmin: user.isSuperAdmin || false,
      isPartner: false,
    };
  } catch (error) {
    return null;
  }
}

export function toAdminAuditSession(
  session: Awaited<ReturnType<typeof getServerSession>>
): AdminAuditSession | null {
  if (!session?.email) return null;
  const userId =
    session.userId != null
      ? String(session.userId)
      : session.id != null
        ? String(session.id)
        : '';
  if (!userId || userId === '[object Object]') return null;
  return {
    userId,
    email: session.email,
    name: session.name,
    isSuperAdmin: session.isSuperAdmin,
    isPartner: isPartnerSession(session),
    referralRole: session.referralRole,
  };
}

/** Returns 401/403 NextResponse or null when session is a full admin (not partner). */
export async function requireFullAdminSession(): Promise<
  | { session: NonNullable<Awaited<ReturnType<typeof getServerSession>>>; error: null }
  | { session: null; error: NextResponse }
> {
  const session = await getServerSession();
  if (!session) {
    return {
      session: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  if (isPartnerSession(session)) {
    return {
      session: null,
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }
  return { session, error: null };
}

/** Returns 401/403 NextResponse or null when session is a super admin. */
export async function requireSuperAdminSession(): Promise<
  | { session: NonNullable<Awaited<ReturnType<typeof getServerSession>>>; error: null }
  | { session: null; error: NextResponse }
> {
  const session = await getServerSession();
  if (!session) {
    return {
      session: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  if (!session.isSuperAdmin) {
    return {
      session: null,
      error: NextResponse.json(
        { error: 'Only super admins can access this resource' },
        { status: 403 }
      ),
    };
  }
  return { session, error: null };
}

/**
 * Re-checks the currently logged-in admin's own password — used as a second
 * confirmation gate before irreversible actions (company delete/archive/
 * restore), independent of the session cookie already proving who they are.
 */
export async function verifyAdminPassword(email: string, password: string): Promise<boolean> {
  await dbConnect();
  const admin = await AdminUser.findOne({ email });
  return Boolean(admin && admin.password === password);
}
