import jwt from 'jsonwebtoken';

export const PARTNER_SSO_PURPOSE = 'partner_admin_handoff';

export function getPartnerSsoSecret(): string {
  return process.env.PARTNER_PORTAL_SSO_SECRET?.trim() || '';
}

export type PartnerHandoffClaims = {
  purpose: string;
  referralUserId: string;
  email: string;
  role: string;
};

export function verifyPartnerHandoffToken(token: string): PartnerHandoffClaims {
  const secret = getPartnerSsoSecret();
  if (!secret) {
    throw new Error('Partner SSO is not configured');
  }

  const decoded = jwt.verify(token, secret) as jwt.JwtPayload;
  if (decoded.purpose !== PARTNER_SSO_PURPOSE) {
    throw new Error('Invalid handoff token');
  }

  const referralUserId = decoded.referralUserId ? String(decoded.referralUserId) : '';
  const email = decoded.email ? String(decoded.email) : '';
  const role = decoded.role ? String(decoded.role) : '';

  if (!referralUserId || !email) {
    throw new Error('Invalid handoff token payload');
  }

  return {
    purpose: PARTNER_SSO_PURPOSE,
    referralUserId,
    email,
    role,
  };
}
