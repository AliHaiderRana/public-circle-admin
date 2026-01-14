import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import AdminUser from '@/lib/models/AdminUser';
import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

export async function POST(request: Request) {
  await dbConnect();
  try {
    const { email, password } = await request.json();

    const user = await AdminUser.findOne({ email });
    if (!user || user.password !== password) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email, name: user.name || '', isSuperAdmin: user.isSuperAdmin || false },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    const cookie = serialize('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 1 day
      path: '/',
    });

    const response = NextResponse.json({
      message: 'Login successful',
      user: { email: user.email, name: user.name || '' }
    });

    response.headers.append('Set-Cookie', cookie);
    return response;
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
