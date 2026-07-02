import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import AdminUser from '@/lib/models/AdminUser';
import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';
import { ADMIN_JWT_SECRET } from '@/lib/admin-jwt';
import { validateReferralPartnerCredentials } from '@/lib/referral-partner.service';
import { toAdminAuditSession } from '@/lib/auth';
import { logPartnerPortalActivity, PARTNER_PORTAL_ACTIONS } from '@/lib/partner-activity';

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

    let partnerUser = null;
    try {
      partnerUser = await validateReferralPartnerCredentials(email, password);
    } catch (partnerError) {
      console.error('[auth/login] partner credential lookup failed:', partnerError);
      if (
        partnerError instanceof Error &&
        partnerError.message.includes('REFERRAL_APP_MONGODB_URL')
      ) {
        return NextResponse.json({ error: 'Partner login is unavailable' }, { status: 503 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    if (!partnerUser) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const partnerName =
      [partnerUser.firstName, partnerUser.lastName].filter(Boolean).join(' ') ||
      partnerUser.emailAddress;

    const token = jwt.sign(
      {
        userId: String(partnerUser._id),
        email: partnerUser.emailAddress,
        name: partnerName,
        isSuperAdmin: false,
        isPartner: true,
        referralUserId: String(partnerUser._id),
        referralRole: partnerUser.role,
      },
      ADMIN_JWT_SECRET,
      { expiresIn: '1d' },
    );

    const response = NextResponse.json({
      message: 'Login successful',
      user: {
        id: String(partnerUser._id),
        email: partnerUser.emailAddress,
        name: partnerName,
        isSuperAdmin: false,
        isPartner: true,
        referralUserId: String(partnerUser._id),
        referralRole: partnerUser.role,
      },
    });
    response.headers.append('Set-Cookie', issueAuthCookie(token));

    const auditSession = toAdminAuditSession({
      userId: String(partnerUser._id),
      email: partnerUser.emailAddress,
      name: partnerName,
      isSuperAdmin: false,
      isPartner: true,
      referralRole: partnerUser.role,
    });
    if (auditSession) {
      await logPartnerPortalActivity(auditSession, {
        action: PARTNER_PORTAL_ACTIONS.LOGIN,
        summary: 'Partner signed in to customer portal',
      });
    }

    return response;
  } catch (error) {
    console.error('[auth/login] failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
