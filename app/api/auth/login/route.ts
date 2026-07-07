import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import AdminUser from '@/lib/models/AdminUser';
import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';
import { ADMIN_JWT_SECRET } from '@/lib/admin-jwt';
import { findReferralPartnerAccountByEmail } from '@/lib/referral-partner.service';

function issueAuthCookie(token: string) {
  return serialize('admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24,
    path: '/',
  });
}

export async function POST(request: Request) {
  try {
    const { email: rawEmail, password } = await request.json();
    const email = typeof rawEmail === 'string' ? rawEmail.trim() : '';

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    await dbConnect();
    const adminUser = await AdminUser.findOne({ email });
    if (adminUser && adminUser.password === password) {
      const token = jwt.sign(
        {
          userId: adminUser._id.toString(),
          email: adminUser.email,
          name: adminUser.name || '',
          isSuperAdmin: adminUser.isSuperAdmin || false,
          isPartner: false,
        },
        ADMIN_JWT_SECRET,
        { expiresIn: '1d' },
      );

      const response = NextResponse.json({
        message: 'Login successful',
        user: {
          email: adminUser.email,
          name: adminUser.name || '',
          isSuperAdmin: adminUser.isSuperAdmin || false,
          isPartner: false,
        },
      });
      response.headers.append('Set-Cookie', issueAuthCookie(token));
      return response;
    }

    try {
      const referralPartner = await findReferralPartnerAccountByEmail(email);
      if (referralPartner) {
        return NextResponse.json(
          {
            error:
              'Referral partners cannot sign in on this page. Open Support & Customers from the Venndii Referral App.',
          },
          { status: 403 },
        );
      }
    } catch (partnerError) {
      console.error('[auth/login] referral partner lookup failed:', partnerError);
      if (
        partnerError instanceof Error &&
        partnerError.message.includes('REFERRAL_APP_MONGODB_URL')
      ) {
        return NextResponse.json({ error: 'Login is temporarily unavailable' }, { status: 503 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  } catch (error) {
    console.error('[auth/login] failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}



