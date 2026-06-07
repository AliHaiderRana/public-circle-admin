import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/db';
import AdminUser from '@/lib/models/AdminUser';
import type { AdminAuditSession } from '@/lib/admin-audit.constants';

const JWT_SECRET = process.env.JWT_SECRET || process.env.ACCESS_TOKEN_SECRET || 'fallback_secret';

export async function getServerSession() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;

    if (!token) return null;

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
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
  };
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
