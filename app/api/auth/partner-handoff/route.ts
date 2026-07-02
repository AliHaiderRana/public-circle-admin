import { NextResponse } from 'next/server';
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const handoffToken =
      typeof body?.handoffToken === 'string' ? body.handoffToken.trim() : '';

    if (!handoffToken) {
      return NextResponse.json({ error: 'handoffToken is required' }, { status: 400 });
    }

    const { token, user } = await completePartnerHandoff(handoffToken);

    const response = NextResponse.json({
      message: 'Partner handoff successful',
      user,
    });
    response.headers.append('Set-Cookie', issueAuthCookie(token));

    return response;
  } catch (error) {
    console.error('[auth/partner-handoff] failed:', error);
    return NextResponse.json({ error: 'Invalid or expired handoff' }, { status: 401 });
  }
}
