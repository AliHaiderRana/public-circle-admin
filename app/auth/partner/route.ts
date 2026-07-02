import { NextResponse } from 'next/server';
import { PARTNER_HOME_PATH } from '@/lib/partner-routes.util';
import { serialize } from 'cookie';
import { completePartnerHandoff } from '@/lib/partner-handoff.server';

function issueAuthCookie(token: string) {
  return serialize('admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24,
    path: '/',
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const handoffToken = searchParams.get('handoff')?.trim();

  if (!handoffToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const { token } = await completePartnerHandoff(handoffToken);
    const response = NextResponse.redirect(new URL(PARTNER_HOME_PATH, request.url));
    response.headers.append('Set-Cookie', issueAuthCookie(token));
    return response;
  } catch (error) {
    console.error('[auth/partner] handoff failed:', error);
    return NextResponse.redirect(new URL('/login?error=partner_handoff', request.url));
  }
}
