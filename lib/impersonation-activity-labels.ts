export const IMPERSONATION_ACTIVITY_TYPE_LABELS: Record<string, string> = {
  SESSION_START: 'Session started',
  SESSION_END: 'Session ended',
  API_REQUEST: 'Action',
  CLIENT_ACTION: 'Client action',
};

const NOISE_PATH_PATTERNS = [
  /get-dashboard-data/i,
  /get-paginated-contacts/i,
  /get-segment-count/i,
  /get-filter-count/i,
  /get-selection-effect/i,
  /duplicates\/recompute/i,
  /recomputed duplicate/i,
  /\/segments\/all$/i,
  /\/filters\/all$/i,
  /\/filters\/get-data-type/i,
  /^WEBSOCKET_/i,
  /^\/users\/me$/i,
  /^\/auth\/token$/i,
  /^\/notifications/i,
];

const GROUPING_TYPE_LABELS: Record<string, string> = {
  PROJECT: 'project',
  CAMPAIGN: 'campaign group',
  TEMPLATE: 'template group',
};

type DisplayRow = {
  summary: string | null;
  path: string | null;
  type: string;
  method: string | null;
  metadata?: Record<string, unknown> | null;
  requestBody?: Record<string, unknown> | null;
};

function pickEntityNameFromRequestBody(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  const b = body as Record<string, unknown>;
  const keys = [
    'filterLabel',
    'campaignName',
    'name',
    'title',
    'groupName',
    'filterName',
    'emailAddress',
    'email',
    'segmentName',
  ];
  for (const key of keys) {
    const val = b[key];
    if (typeof val === 'string' && val.trim()) return val.trim();
  }
  const first = typeof b.firstName === 'string' ? b.firstName.trim() : '';
  const last = typeof b.lastName === 'string' ? b.lastName.trim() : '';
  if (first || last) return [first, last].filter(Boolean).join(' ');
  return '';
}

function resolveDisplayEntityName(row: DisplayRow): string {
  const fromMeta = entityNameFromMetadata(row.metadata);
  if (fromMeta) return fromMeta;
  return pickEntityNameFromRequestBody(row.requestBody);
}

const EMAIL_IN_PATH = /\/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?=\/|$)/gi;

const normalizePathKey = (path: string) => {
  let p = path.trim().split('?')[0];
  if (p && !p.startsWith('/')) p = `/${p}`;
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  p = p.replace(/\/[a-f\d]{24}(?=\/|$)/gi, '/:id');
  p = p.replace(EMAIL_IN_PATH, '/:email');
  p = p.replace(
    /\/email\/domain\/([^/]+)(?=\/|$)/gi,
    (match, segment) => {
      if (['email-address', 'domain-name', 'verify'].includes(segment.toLowerCase())) {
        return match;
      }
      return '/email/domain/:domain';
    }
  );
  return p;
};

const extractEmailFromPath = (path: string): string | null => {
  const normalized = normalizePathKey(path).includes('@')
    ? path.trim().split('?')[0]
    : path;
  let p = normalized;
  if (p && !p.startsWith('/')) p = `/${p}`;
  const match = p.match(
    /\/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?=\/|$)/i
  );
  return match ? decodeURIComponent(match[0].replace(/^\//, '')) : null;
};

const quote = (name: string) => (name ? ` “${name}”` : '');

function entityNameFromMetadata(metadata?: Record<string, unknown> | null): string {
  return typeof metadata?.entityName === 'string' ? metadata.entityName.trim() : '';
}

/** Append stored entity name when summary text omits it (e.g. "Created segment" → "Created segment "VIP""). */
function enrichSummaryWithEntityName(summary: string, entityName: string): string {
  const text = summary.trim();
  const name = entityName.trim();
  if (!text || !name) return text || summary;
  if (text.includes(`“${name}”`) || text.includes(`"${name}"`)) return text;
  return `${text}${quote(name)}`;
}

const PATH_LIKE_TEXT = /^\/?[a-z][a-z0-9-]*\/[a-f0-9]{24}(\/[a-z0-9-]*)?$/i;

function isPathLikeText(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (PATH_LIKE_TEXT.test(t)) return true;
  if (/^(POST|PUT|PATCH|DELETE)\s+\//i.test(t)) return true;
  return false;
}

function crudVerb(method: string): 'Created' | 'Updated' | 'Deleted' | 'Changed' {
  if (method === 'DELETE') return 'Deleted';
  if (method === 'POST') return 'Created';
  if (method === 'PUT' || method === 'PATCH') return 'Updated';
  return 'Changed';
}

/** Standard collection + /:id CRUD labels for impersonation audit rows. */
function legacyResourceCrud(
  method: string,
  pathPattern: string,
  q: string,
  resource: string,
  noun: string,
  options?: { clonePath?: string; duplicatePath?: string }
): string | null {
  const m = method;
  const base = `/${resource}`;
  const byId = `${base}/:id`;
  if (pathPattern === base && m === 'POST') return `Created ${noun}${q}`;
  if (pathPattern === byId && m === 'DELETE') return `Deleted ${noun}${q}`;
  if (pathPattern === byId && (m === 'PATCH' || m === 'PUT')) return `Updated ${noun}${q}`;
  if (options?.clonePath && pathPattern === options.clonePath && m === 'POST') {
    return `Duplicated ${noun}${q}`;
  }
  if (options?.duplicatePath && pathPattern === options.duplicatePath && m === 'POST') {
    return `Duplicated ${noun}${q}`;
  }
  if (!pathPattern.startsWith(base)) return null;
  return `${crudVerb(m)} ${noun}${q}`;
}

function legacySummaryFromPathPattern(
  method: string | null,
  pathPattern: string,
  metadata?: Record<string, unknown> | null,
  rawPath?: string | null
): string | null {
  const m = method || 'POST';
  const entityName =
    typeof metadata?.entityName === 'string' ? metadata.entityName.trim() : '';
  const email = extractEmailFromPath(rawPath || '');
  const groupingType =
    typeof metadata?.groupingType === 'string' ? metadata.groupingType : '';
  const q = quote(entityName);
  const groupingNoun = GROUPING_TYPE_LABELS[groupingType] || 'group';

  if (pathPattern.startsWith('/company-grouping')) {
    if (pathPattern === '/company-grouping' && m === 'POST') {
      return `Created ${groupingNoun}${q}`;
    }
    if (pathPattern === '/company-grouping/:id' && m === 'PUT') {
      return `Updated ${groupingNoun}${q}`;
    }
    if (pathPattern === '/company-grouping/:id' && m === 'DELETE') {
      return `Deleted ${groupingNoun}${q}`;
    }
    if (pathPattern === '/company-grouping/:id/archive') {
      return `Archived project${q}`;
    }
    if (pathPattern === '/company-grouping/:id/unarchive') {
      return `Restored archived project${q}`;
    }
    return `${m === 'DELETE' ? 'Deleted' : m === 'PUT' || m === 'PATCH' ? 'Updated' : 'Changed'} ${groupingNoun}${q}`;
  }

  if (pathPattern === '/access-tokens' && m === 'POST') return `Created webhook${q}`;
  if (pathPattern === '/access-tokens/:id' && m === 'PATCH') return `Updated webhook${q}`;
  if (pathPattern === '/access-tokens/:id' && m === 'DELETE') return `Revoked webhook${q}`;

  if (pathPattern === '/users' && m === 'POST') return `Invited team member${q}`;
  if (pathPattern === '/users/:id' && m === 'DELETE') return `Removed team member${q}`;
  if (pathPattern === '/users/:id') return `Updated team member${q}`;
  if (pathPattern === '/users' && (m === 'PATCH' || m === 'PUT')) {
    return 'Updated organization or profile settings';
  }

  if (pathPattern.startsWith('/configuration/email') || pathPattern === '/configuration') {
    const emailAddr =
      entityName ||
      email ||
      extractEmailFromPath(typeof metadata?.path === 'string' ? metadata.path : '');
    const eq = quote(emailAddr || '');
    if (pathPattern === '/configuration/email/address' && m === 'POST') {
      return `Added sending email address${eq}`;
    }
    if (pathPattern === '/configuration/email/address/verify' && m === 'POST') {
      return `Verified sending email address${eq}`;
    }
    if (pathPattern === '/configuration/email/address/:email' && m === 'DELETE') {
      return `Removed sending email address${eq}`;
    }
    if (pathPattern === '/configuration/email/domain' && m === 'POST') {
      return `Started email domain verification${eq}`;
    }
    if (pathPattern === '/configuration/email/domain/:domain' && m === 'DELETE') {
      return `Removed email domain${eq}`;
    }
    if (pathPattern === '/configuration/email/domain/email-address' && m === 'POST') {
      return `Added email on verified domain${eq}`;
    }
    if (pathPattern === '/configuration' && m === 'POST') {
      return 'Updated email sending configuration';
    }
    return `Updated email configuration${eq}`;
  }

  if (pathPattern === '/emails/verify-apple-relay' && m === 'POST') {
    return `Sent Apple Private Relay verification${quote(email || entityName)}`;
  }
  if (pathPattern === '/emails/disable-private-relay' && m === 'POST') {
    return `Disabled Apple Private Relay${quote(email || entityName)}`;
  }

  if (pathPattern === '/company-contacts/unsubscribe-key') {
    const kq = quote(entityName);
    if (m === 'POST') return `Set unsubscribe key${kq}`;
    if (m === 'PATCH') return `Updated unsubscribe key${kq}`;
    if (m === 'DELETE') return 'Deleted unsubscribe key';
    return `Changed unsubscribe key${kq}`;
  }

  const segmentsLabel = legacyResourceCrud(m, pathPattern, q, 'segments', 'segment', {
    clonePath: '/segments/:id/clone',
  });
  if (segmentsLabel) return segmentsLabel;

  const filtersLabel = legacyResourceCrud(m, pathPattern, q, 'filters', 'field');
  if (filtersLabel) return filtersLabel;

  const templatesLabel = legacyResourceCrud(m, pathPattern, q, 'templates', 'email template', {
    duplicatePath: '/templates/duplicate/:id',
  });
  if (templatesLabel) return templatesLabel;
  if (pathPattern === '/templates/duplicate' && m === 'POST') {
    return `Duplicated email template${q}`;
  }

  if (pathPattern.startsWith('/campaigns')) {
    if (pathPattern === '/campaigns/draft' && m === 'POST') return `Saved campaign draft${q}`;
    if (pathPattern === '/campaigns' && m === 'POST') return `Created or launched campaign${q}`;
    if (pathPattern === '/campaigns/:id' && m === 'DELETE') return `Deleted campaign${q}`;
    if (pathPattern === '/campaigns/:id' && (m === 'PATCH' || m === 'PUT')) {
      return `Updated campaign${q}`;
    }
    if (pathPattern === '/campaigns/:id/archive' && m === 'POST') {
      return `Archived or restored campaign${q}`;
    }
    return `${crudVerb(m)} campaign${q}`;
  }

  const rolesLabel = legacyResourceCrud(m, pathPattern, q, 'roles', 'role');
  if (rolesLabel) return rolesLabel;

  const assetsLabel = legacyResourceCrud(m, pathPattern, q, 'assets', 'asset');
  if (assetsLabel) return assetsLabel;
  if (pathPattern === '/assets/file-upload-url' && m === 'POST') return 'Started asset upload';
  if (pathPattern === '/assets/file-upload/:id' && m === 'PATCH') {
    return `Completed asset upload${q}`;
  }

  const attachmentsLabel = legacyResourceCrud(m, pathPattern, q, 'attachments', 'attachment');
  if (attachmentsLabel) return attachmentsLabel;
  if (pathPattern === '/attachments/upload' && m === 'POST') return 'Uploaded attachment';

  const socialLabel = legacyResourceCrud(m, pathPattern, q, 'social-links', 'social link');
  if (socialLabel) return socialLabel;

  if (pathPattern.startsWith('/company-contacts')) {
    if (pathPattern === '/company-contacts' && m === 'POST') return `Added contact${q}`;
    if (pathPattern === '/company-contacts/:id' && m === 'DELETE') return `Deleted contact${q}`;
    if (pathPattern === '/company-contacts/:id' && (m === 'PATCH' || m === 'PUT')) {
      return `Updated contact${q}`;
    }
    if (pathPattern === '/company-contacts/manual' && m === 'POST') {
      return `Added contact manually${q}`;
    }
    if (pathPattern === '/company-contacts/finalize-contact' && m === 'POST') {
      return 'Finalized contact list';
    }
    if (pathPattern === '/company-contacts/revert-finalize-contact-request' && m === 'POST') {
      return 'Requested revert of contact finalize';
    }
    if (
      (pathPattern === '/company-contacts/cancel/revert-finalize-contact-request' ||
        pathPattern === '/company-contacts/cancel-revert') &&
      m === 'POST'
    ) {
      return 'Cancelled revert finalize request';
    }
    if (pathPattern === '/company-contacts/resolve-duplicates' && m === 'POST') {
      return 'Resolved duplicate contacts';
    }
    if (pathPattern === '/company-contacts/upload-csv' && m === 'POST') {
      return 'Uploaded contacts CSV';
    }
    if (pathPattern === '/company-contacts/delete/all' && m === 'DELETE') {
      return 'Deleted all contacts';
    }
    if (pathPattern === '/company-contacts/unsubscribe-key') {
      if (m === 'POST') return `Set unsubscribe key${q}`;
      if (m === 'PATCH') return `Updated unsubscribe key${q}`;
      if (m === 'DELETE') return 'Deleted unsubscribe key';
    }
    if (pathPattern === '/company-contacts/primary-key') {
      if (m === 'POST') return `Set contact primary key${q}`;
      if (m === 'PATCH') return `Updated contact primary key${q}`;
      if (m === 'DELETE') return 'Removed contact primary key';
    }
    return `${crudVerb(m)} contact${q}`;
  }

  if (pathPattern.startsWith('/stripe')) {
    if (pathPattern.includes('cancel')) return 'Cancelled subscription';
    if (pathPattern.includes('top-up')) return 'Purchased top-up';
    if (m === 'DELETE') return 'Removed billing item';
    return 'Updated billing';
  }

  return null;
}

function looksLikeRawTechnicalSummary(summary: string, path: string): boolean {
  if (!summary) return true;
  if (/^(POST|PUT|PATCH|DELETE)\s+\//.test(summary)) return true;
  if (path && summary === path) return true;
  if (/^\/?[a-z-]+\/[a-f\d]{24}$/i.test(summary)) return true;
  if (/^[a-z-]+$/.test(summary) && !summary.includes(' ')) return true;
  if (
    /^(configuration|emails|roles|assets|attachments|social-links|stripe|segments|filters|templates|campaigns|company-contacts|access-tokens|company-grouping|users)\//i.test(
      summary
    )
  ) {
    return true;
  }
  if (/^[a-z-]+\/[a-z0-9@._-]+$/i.test(summary)) return true;
  if (/unsubscribe-key|get-paginated-contacts/i.test(summary)) return true;
  if (summary.includes('@') && !summary.includes(' ')) return true;
  return false;
}

/** Prefer stored summary; map raw paths / client codes to readable text. */
function formatImpersonationDisplaySummaryInner(row: DisplayRow): string {
  const summary = (row.summary || '').trim();
  const path = (row.path || '').trim();
  const metadata = row.metadata;
  const pathPattern = normalizePathKey(
    typeof metadata?.pathPattern === 'string' && metadata.pathPattern.trim()
      ? String(metadata.pathPattern)
      : path || ''
  );

  if (row.type === 'SESSION_START') {
    return summary || 'Started Login as user session';
  }
  if (row.type === 'SESSION_END') {
    return summary || 'Ended Login as user session';
  }

  if (path === 'WEBSOCKET_CONNECT') return 'Connected to real-time updates';
  if (path === 'WEBSOCKET_DISCONNECT') return 'Disconnected from real-time updates';

  const storedEntityName = resolveDisplayEntityName(row);
  const metadataWithName =
    storedEntityName && metadata
      ? { ...metadata, entityName: storedEntityName }
      : storedEntityName
        ? { ...(metadata || {}), entityName: storedEntityName }
        : metadata;

  if (summary && !looksLikeRawTechnicalSummary(summary, path)) {
    return enrichSummaryWithEntityName(summary, storedEntityName);
  }

  const legacy = legacySummaryFromPathPattern(
    row.method,
    pathPattern,
    metadataWithName,
    path
  );
  if (legacy) return enrichSummaryWithEntityName(legacy, storedEntityName);

  if (path.includes('get-dashboard-data')) return 'Loaded dashboard statistics';

  if (summary && summary.includes(' ')) return summary;

  const resource = (pathPattern || path).split('/').filter(Boolean)[0] || 'item';
  const verb =
    row.method === 'DELETE'
      ? 'Deleted'
      : row.method === 'POST'
        ? 'Created'
        : row.method === 'PUT' || row.method === 'PATCH'
          ? 'Updated'
          : 'Changed';
  const fallback = enrichSummaryWithEntityName(
    `${verb} ${resource.replace(/-/g, ' ')}`,
    storedEntityName
  );
  if (isPathLikeText(fallback)) {
    return `${crudVerb(row.method || 'POST')} item${quote(storedEntityName)}`;
  }
  return fallback;
}

export function formatImpersonationDisplaySummary(row: DisplayRow): string {
  const result = formatImpersonationDisplaySummaryInner(row);
  if (!isPathLikeText(result)) return result;
  const path = (row.path || '').trim();
  const metadata = row.metadata;
  const pathPattern = normalizePathKey(
    typeof metadata?.pathPattern === 'string' && metadata.pathPattern.trim()
      ? String(metadata.pathPattern)
      : path || ''
  );
  const legacy = legacySummaryFromPathPattern(
    row.method,
    pathPattern,
    metadata,
    path
  );
  if (legacy) return enrichSummaryWithEntityName(legacy, resolveDisplayEntityName(row));
  return `${crudVerb(row.method || 'POST')} item${quote(resolveDisplayEntityName(row))}`;
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
  email: 'Email configuration',
  other: 'Other',
};
