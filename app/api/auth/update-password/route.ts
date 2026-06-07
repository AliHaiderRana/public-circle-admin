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
    const { currentPassword, newPassword } = await request.json();
    const sessionEmail = typeof session === 'string' ? session : session.email;

    const user = await AdminUser.findOne({ email: sessionEmail });
    if (!user || user.password !== currentPassword) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
    }

    user.password = newPassword;
    await user.save();

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.ADMIN_PROFILE_UPDATE,
        category: ADMIN_AUDIT_CATEGORY.ADMIN_USER,
        resourceType: 'admin_user',
        resourceId: String(user._id),
        details: { field: 'password' },
      });
    }

    return NextResponse.json({ message: 'Password updated successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });
  }
}
