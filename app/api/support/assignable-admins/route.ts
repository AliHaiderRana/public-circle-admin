import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import AdminUser from '@/lib/models/AdminUser';
import { getServerSession } from '@/lib/auth';
import { denyPartnerSupportAccess } from '@/lib/partner-access.util';

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supportDenied = denyPartnerSupportAccess(session);
  if (supportDenied) return supportDenied;

  await dbConnect();

  try {
    const admins = await AdminUser.find({})
      .select('_id name email isSuperAdmin')
      .sort({ name: 1, email: 1 })
      .lean();

    return NextResponse.json({
      admins: admins.map((admin) => ({
        id: String(admin._id),
        name: admin.name || admin.email,
        email: admin.email,
        isSuperAdmin: Boolean(admin.isSuperAdmin),
      })),
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch admins' }, { status: 500 });
  }
}
