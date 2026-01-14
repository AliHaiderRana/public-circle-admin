import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/db';
import AdminUser from '@/lib/models/AdminUser';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token')?.value;

  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Fetch fresh user data from database to get latest name and isSuperAdmin
    await dbConnect();
    const user = await AdminUser.findOne({ email: decoded.email }).select('_id email name isSuperAdmin');
    
    // If user doesn't exist in database (was deleted), invalidate session
    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    
    return NextResponse.json({
      authenticated: true,
      user: { 
        id: user._id.toString(),
        email: user.email, 
        name: user.name || '',
        isSuperAdmin: user.isSuperAdmin || false
      },
      token: token, // Return token for socket connection
    });
  } catch (error) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
