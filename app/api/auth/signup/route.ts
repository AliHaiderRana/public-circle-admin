import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import AdminUser from '@/lib/models/AdminUser';
import AppConfig from '@/lib/models/AppConfig';

export async function POST(request: Request) {
  await dbConnect();
  try {
    const { email, password } = await request.json();

    // Check if signup is allowed
    const config = await AppConfig.findOne();
    if (config && !config.isSignupAllowed) {
      return NextResponse.json({ error: 'Signup is currently disabled' }, { status: 403 });
    }

    const existingUser = await AdminUser.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 });
    }

    // Password is NOT hashed as per user request
    const user = await AdminUser.create({ email, password });

    return NextResponse.json({ message: 'User created successfully', user: { email: user.email } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
