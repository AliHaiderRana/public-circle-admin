export const IMPERSONATION_ACTIVITY_TYPE_LABELS: Record<string, string> = {
  SESSION_START: 'Session started',
  SESSION_END: 'Session ended',
  API_REQUEST: 'Action',
  CLIENT_ACTION: 'Client action',
};

const NOISE_PATH_PATTERNS = [
  /get-dashboard-data/i,
  /^WEBSOCKET_/i,
  /^\/users\/me$/i,
  /^\/auth\/token$/i,
  /^\/notifications/i,
];

/** Prefer stored summary; map raw paths / client codes to readable text. */
export function formatImpersonationDisplaySummary(row: {
  summary: string | null;
  path: string | null;
  type: string;
  method: string | null;
}): string {
  const summary = (row.summary || '').trim();
  const path = (row.path || '').trim();

  if (row.type === 'SESSION_START') {
    return summary || 'Started Login as user session';
  }
  if (row.type === 'SESSION_END') {
    return summary || 'Ended Login as user session';
  }

  if (path === 'WEBSOCKET_CONNECT') return 'Connected to real-time updates';
  if (path === 'WEBSOCKET_DISCONNECT') return 'Disconnected from real-time updates';

  if (summary && !summary.startsWith('POST ') && !summary.startsWith('PATCH ') && !summary.startsWith('DELETE ') && !summary.startsWith('PUT ')) {
    return summary;
  }

  if (path.includes('get-dashboard-data')) return 'Loaded dashboard statistics';

  if (summary) return summary;
  if (path) return path.replace(/_/g, ' ').replace(/^\//, '');
  return 'Activity';
}

export function isNoiseImpersonationRow(row: {
  path: string | null;
  type: string;
  summary: string | null;
}): boolean {
  const path = (row.path || '').trim();
  const summary = (row.summary || '').trim();
  if (NOISE_PATH_PATTERNS.some((re) => re.test(path) || re.test(summary))) {
    return true;
  }
  if (row.type === 'CLIENT_ACTION' && /^WEBSOCKET_/i.test(path)) {
    return true;
  }
  if (/^WEBSOCKET/i.test(summary) || /^WEBSOCKET/i.test(path)) {
    return true;
  }
  return false;
}

export const IMPERSONATION_ACTIVITY_CATEGORY_LABELS: Record<string, string> = {
  session: 'Session',
  campaign: 'Campaign',
  template: 'Template',
  segment: 'Segment',
  field: 'Field',
  contact: 'Contact',
  contact_request: 'Contact request',
  webhook: 'Webhook',
  member: 'Team member',
  profile: 'Profile & org',
  project: 'Project',
  integration: 'Integration',
  billing: 'Billing',
  other: 'Other',
};
