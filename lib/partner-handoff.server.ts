import jwt from 'jsonwebtoken';
import { ADMIN_JWT_SECRET } from '@/lib/admin-jwt';
import { verifyPartnerHandoffToken } from '@/lib/partner-sso.util';
import { getReferralPartnerById } from '@/lib/referral-partner.service';
import { toAdminAuditSession } from '@/lib/auth';
import { logPartnerPortalActivity, PARTNER_PORTAL_ACTIONS } from '@/lib/partner-activity';

export type PartnerHandoffResult = {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    isSuperAdmin: false;
    isPartner: true;
    referralUserId: string;
    referralRole: string;
  };
};

export async function completePartnerHandoff(handoffToken: string): Promise<PartnerHandoffResult> {
  const claims = verifyPartnerHandoffToken(handoffToken);
  const partner = await getReferralPartnerById(claims.referralUserId);

  if (!partner || partner.emailAddress.toLowerCase() !== claims.email.toLowerCase()) {
    throw new Error('Invalid or expired handoff');
  }

  const partnerName =
    [partner.firstName, partner.lastName].filter(Boolean).join(' ') || partner.emailAddress;

  const token = jwt.sign(
    {
      userId: String(partner._id),
      email: partner.emailAddress,
      name: partnerName,
      isSuperAdmin: false,
      isPartner: true,
      referralUserId: String(partner._id),
      referralRole: partner.role,
    },
    ADMIN_JWT_SECRET,
    { expiresIn: '1d' },
  );

  const auditSession = toAdminAuditSession({
    userId: String(partner._id),
    email: partner.emailAddress,
    name: partnerName,
    isSuperAdmin: false,
    isPartner: true,
    referralRole: partner.role,
  });
  if (auditSession) {
    await logPartnerPortalActivity(auditSession, {
      action: PARTNER_PORTAL_ACTIONS.LOGIN,
      summary: 'Partner signed in via referral app handoff',
    });
  }

  return {
    token,
    user: {
      id: String(partner._id),
      email: partner.emailAddress,
      name: partnerName,
      isSuperAdmin: false,
      isPartner: true,
      referralUserId: String(partner._id),
      referralRole: partner.role,
    },
  };
}
