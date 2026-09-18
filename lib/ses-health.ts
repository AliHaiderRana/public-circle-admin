export type SesHealthStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL';

export type SesHealth = {
  status: SesHealthStatus;
  title: string;
  description: string;
};

export type SesReputationLeader = {
  companyId: string;
  companyName: string | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  sent: number;
  bounces: number;
  hardBounces: number;
  bounceRate: number;
  complaints: number;
  complaintRate: number;
};

export const SES_HEALTH_HREF = '/dashboard/aws-analytics/ses';

export function getOverallHealthStatus(
  bounceRate: number | null,
  complaintRate: number | null,
  sendingEnabled: boolean
): SesHealth {
  if (!sendingEnabled) {
    return {
      status: 'CRITICAL',
      title: 'Account Sending Paused by AWS',
      description:
        'Amazon SES sending is paused for this account. Check SES console for suspension details.',
    };
  }

  const b = bounceRate ?? 0;
  const c = complaintRate ?? 0;

  if (b >= 10.0 || c >= 0.5) {
    return {
      status: 'CRITICAL',
      title: 'CRITICAL — High Danger of AWS Suspension',
      description:
        'Account reputation metrics exceed AWS pause limits (10% Bounce / 0.5% Complaint). Immediate cleanup required.',
    };
  }

  if (b >= 5.0 || c >= 0.1) {
    return {
      status: 'WARNING',
      title: 'WARNING — Approaching AWS Risk Thresholds',
      description:
        'Reputation metrics exceed AWS target limits (5% Bounce / 0.1% Complaint). AWS may place account under review.',
    };
  }

  return {
    status: 'HEALTHY',
    title: 'HEALTHY — Low Danger of AWS Action',
    description:
      'Account metrics are safely within AWS operating limits (Bounce < 5.0%, Complaint < 0.10%).',
  };
}
