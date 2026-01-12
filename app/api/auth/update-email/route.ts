import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import AdminUser from '@/lib/models/AdminUser';
import { getServerSession } from '@/lib/auth';

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  
  try {
    const { email } = await request.json();
    const sessionEmail = typeof session === 'string' ? session : session.email;

    const existingUser = await AdminUser.findOne({ email });
    if (existingUser && existingUser.email !== sessionEmail) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
    }

    await AdminUser.updateOne({ email: sessionEmail }, { email });

    return NextResponse.json({ message: 'Email updated successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update email' }, { status: 500 });
  }
}
