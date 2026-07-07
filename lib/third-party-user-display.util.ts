export function formatThirdPartyUserName(user: {
  firstName?: string;
  lastName?: string;
  emailAddress?: string;
}) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.emailAddress || '—';
}

export function formatReferralRoleLabel(role?: string) {
  if (role === 'SALES_PERSON') return 'Sales person';
  if (role === 'MARKETING_AFFILIATE') return 'Marketing affiliate';
  if (role === 'ADMIN') return 'Referral admin';
  return role?.replace(/_/g, ' ') || '—';
}

export function formatPortalAccessLabel(access?: string) {
  switch (access) {
    case 'active':
      return 'Active';
    case 'eligible':
      return 'Eligible';
    case 'revoked':
      return 'Revoked';
    case 'none':
    default:
      return 'None';
  }
}

export function isReferralSignupComplete(user?: { signupStep?: number; role?: string }) {
  if (!user) return false;
  const step = Number(user.signupStep ?? 0);
  const contractRoles = new Set(['SALES_PERSON', 'MARKETING_AFFILIATE']);
  if (step < 4) return false;
  if (step === 4 && contractRoles.has(String(user.role))) return false;
  return step >= 5 || (step >= 4 && !contractRoles.has(String(user.role)));
}
