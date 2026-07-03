import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/db';
import AdminUser from '@/lib/models/AdminUser';
import { ADMIN_JWT_SECRET } from '@/lib/admin-jwt';
import { getReferralPartnerById } from '@/lib/referral-partner.service';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token')?.value;

  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  try {
    const decoded = jwt.verify(token, ADMIN_JWT_SECRET) as any;

    if (decoded.isPartner && decoded.referralUserId) {
      const partner = await getReferralPartnerById(String(decoded.referralUserId));
      if (!partner) {
        return NextResponse.json({ authenticated: false }, { status: 401 });
      }

      const name =
        [partner.firstName, partner.lastName].filter(Boolean).join(' ') ||
        partner.emailAddress;

      return NextResponse.json({
        authenticated: true,
        user: {
          id: String(partner._id),
          email: partner.emailAddress,
          name,
          isSuperAdmin: false,
          isPartner: true,
          referralUserId: String(partner._id),
          referralRole: partner.role,
        },
        token,
      });
    }

    await dbConnect();
    const user = await AdminUser.findOne({ email: decoded.email }).select(
      '_id email name isSuperAdmin',
    );

    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name || '',
        isSuperAdmin: user.isSuperAdmin || false,
        isPartner: false,
      },
      token,
    });
  } catch (error) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
