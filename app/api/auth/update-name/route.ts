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
    const { name } = await request.json();
    const sessionEmail = typeof session === 'string' ? session : session.email;

    const user = await AdminUser.findOne({ email: sessionEmail });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const previousName = user.name ?? '';
    user.name = name;
    await user.save();

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.ADMIN_PROFILE_UPDATE,
        category: ADMIN_AUDIT_CATEGORY.ADMIN_USER,
        resourceType: 'admin_user',
        resourceId: String(user._id),
        details: {
          field: 'name',
          name,
          previousName,
        },
      });
    }

    return NextResponse.json({ message: 'Name updated successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update name' }, { status: 500 });
  }
}
