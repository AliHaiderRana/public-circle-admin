import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import AdminUser from '@/lib/models/AdminUser';
import { getServerSession } from '@/lib/auth';

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

    user.name = name;
    await user.save();

    return NextResponse.json({ message: 'Name updated successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update name' }, { status: 500 });
  }
}
