import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/db';
import AdminUser from '@/lib/models/AdminUser';

const JWT_SECRET = process.env.JWT_SECRET || process.env.ACCESS_TOKEN_SECRET || 'fallback_secret';

export async function getServerSession() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;

    if (!token) return null;

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Verify user still exists in database (prevents deleted users from accessing)
    await dbConnect();
    const user = await AdminUser.findOne({ email: decoded.email }).select('_id email name isSuperAdmin');
    
    if (!user) {
      return null; // User was deleted, invalidate session
    }
    
    return {
      ...decoded,
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      isSuperAdmin: user.isSuperAdmin || false
    };
  } catch (error) {
    return null;
  }
}
