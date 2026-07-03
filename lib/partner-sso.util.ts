import jwt from 'jsonwebtoken';
import { getPartnerPortalSsoSecret } from '@/lib/integration-settings.service';

export const PARTNER_SSO_PURPOSE = 'partner_admin_handoff';

export type PartnerHandoffClaims = {
  purpose: string;
  referralUserId: string;
  email: string;
  role: string;
};

export async function verifyPartnerHandoffToken(token: string): Promise<PartnerHandoffClaims> {
  const secret = await getPartnerPortalSsoSecret();
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
