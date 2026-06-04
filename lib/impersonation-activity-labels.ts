export const IMPERSONATION_ACTIVITY_TYPE_LABELS: Record<string, string> = {
  SESSION_START: 'Session started',
  SESSION_END: 'Session ended',
  API_REQUEST: 'Action',
  CLIENT_ACTION: 'Client action',
};

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
