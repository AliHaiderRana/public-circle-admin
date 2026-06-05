import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import AdminUser from '@/lib/models/AdminUser';
import { getServerSession, toAdminAuditSession } from '@/lib/auth';
import {
  logAdminActivity,
  ADMIN_AUDIT_ACTION,
  ADMIN_AUDIT_CATEGORY,
} from '@/lib/admin-audit';

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  
  try {
    const { email } = await request.json();
    const sessionEmail = typeof session === 'string' ? session : session.email;

    const currentUser = await AdminUser.findOne({ email: sessionEmail }).select('_id email').lean();
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const existingUser = await AdminUser.findOne({ email });
    if (existingUser && existingUser.email !== sessionEmail) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
    }

    await AdminUser.updateOne({ email: sessionEmail }, { email });

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.ADMIN_PROFILE_UPDATE,
        category: ADMIN_AUDIT_CATEGORY.ADMIN_USER,
        resourceType: 'admin_user',
        resourceId: String(currentUser._id),
        details: {
          field: 'email',
          email,
          previousEmail: sessionEmail,
        },
      });
    }

    return NextResponse.json({ message: 'Email updated successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update email' }, { status: 500 });
  }
}
