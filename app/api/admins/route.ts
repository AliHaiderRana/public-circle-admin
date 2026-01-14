import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import AdminUser from '@/lib/models/AdminUser';
import { getServerSession } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  
  try {
    // Always verify super-admin status against the latest DB state
    const currentAdmin = await AdminUser.findOne({ email: (session as any).email }).select('isSuperAdmin');
    if (!currentAdmin || !currentAdmin.isSuperAdmin) {
      return NextResponse.json({ error: 'Only super admins can view admin users' }, { status: 403 });
    }

    const admins = await AdminUser.find({}).select('-password').sort({ createdAt: -1 });
    return NextResponse.json({ admins });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch admins' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  
  try {
    // Check if current user is super admin (from DB, not just token)
    const currentAdmin = await AdminUser.findOne({ email: (session as any).email }).select('isSuperAdmin');
    if (!currentAdmin || !currentAdmin.isSuperAdmin) {
      return NextResponse.json({ error: 'Only super admins can create admin users' }, { status: 403 });
    }

    const { email, password, name, isSuperAdmin } = await request.json();

    const existing = await AdminUser.findOne({ email });
    if (existing) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
    }

    const admin = await AdminUser.create({ 
      email, 
      password, 
      name, 
      isSuperAdmin: isSuperAdmin || false 
    });
    return NextResponse.json({ message: 'Admin created', admin: { email: admin.email } });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create admin' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  
  try {
    // Check if current user is super admin (from DB, not just token)
    const currentAdmin = await AdminUser.findOne({ email: (session as any).email }).select('_id isSuperAdmin');
    if (!currentAdmin || !currentAdmin.isSuperAdmin) {
      return NextResponse.json({ error: 'Only super admins can delete admin users' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Admin ID is required' }, { status: 400 });
    }

    // Prevent super admin from deleting themselves
    if (currentAdmin._id.toString() === id.toString()) {
      return NextResponse.json(
        { error: 'You cannot delete your own admin account' },
        { status: 400 }
      );
    }

    await AdminUser.findByIdAndDelete(id);
    return NextResponse.json({ message: 'Admin deleted' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete admin' }, { status: 500 });
  }
}
