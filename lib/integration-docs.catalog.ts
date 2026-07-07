export type IntegrationCaller =
  | 'venndii-referral-app'
  | 'venndii-referral-be'
  | 'public-circle-admin'
  | 'public-circle-server';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'WS';

export type IntegrationApiCall = {
  id: string;
  caller: IntegrationCaller;
  method: HttpMethod;
  path: string;
  resolvedPath: string;
  auth: string;
  purpose: string;
  trigger: string;
};

export type IntegrationFlowStep = {
  step: number;
  actor: IntegrationCaller | 'partner-user';
  description: string;
};

export type ConfigRequirement = {
  key: string;
  label: string;
  required: boolean;
  configured: boolean;
  hint?: string;
};

export type IntegrationDocSection = {
  id: string;
  title: string;
  summary: string;
  relatedUrlField?: 'adminPortalUrl' | 'serverBaseUrl';
  prerequisites: string[];
  configRequirements: ConfigRequirement[];
  flow: IntegrationFlowStep[];
  apis: IntegrationApiCall[];
};

export type IntegrationDocsInput = {
  adminPortalUrl?: string;
  serverBaseUrl?: string;
  adminPortal?: {
    enabled?: boolean;
    referralEnabled?: boolean;
    partnerPortalSsoSecret?: string;
    adminPortalUrl?: string;
    referralBackendApiKeyConfigured?: boolean;
  };
  publicCircleServer?: {
    enabled?: boolean;
    serverBaseUrl?: string;
    internalApiKey?: string;
  };
};

export type IntegrationDocsResponse = {
  generatedAt: string;
  bases: {
    adminPortalUrl: string;
    serverBaseUrl: string;
  };
  sections: IntegrationDocSection[];
};

const CALLER_LABELS: Record<IntegrationCaller, string> = {
  'venndii-referral-app': 'Venndii Referral App (browser)',
  'venndii-referral-be': 'Venndii Referral API',
  'public-circle-admin': 'Public Circle Admin',
  'public-circle-server': 'Public Circle Server',
};

export function getIntegrationCallerLabel(caller: IntegrationCaller): string {
  return CALLER_LABELS[caller];
}

const REFERRAL_API_ORIGIN_PLACEHOLDER = '{referral-api-origin}';

function trimUrl(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/\/$/, '') : fallback;
}

function joinPath(base: string, path: string): string {
  if (path.startsWith('http')) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const origin = base.trim().replace(/\/$/, '');
  if (!origin) return normalized;
  return `${origin}${normalized}`;
}

function api(
  id: string,
  caller: IntegrationCaller,
  method: HttpMethod,
  base: string,
  path: string,
  auth: string,
  purpose: string,
  trigger: string,
): IntegrationApiCall {
  return {
    id,
    caller,
    method,
    path,
    resolvedPath: joinPath(base, path),
    auth,
    purpose,
    trigger,
  };
}

export function buildIntegrationDocs(input: IntegrationDocsInput = {}): IntegrationDocsResponse {
  const adminPortalUrl = trimUrl(
    input.adminPortalUrl ?? input.adminPortal?.adminPortalUrl,
    'https://admin.example.com',
  );
  const serverBaseUrl = trimUrl(
    input.serverBaseUrl ?? input.publicCircleServer?.serverBaseUrl,
    'https://api.example.com',
  );
  const referralApiDocBase = REFERRAL_API_ORIGIN_PLACEHOLDER;

  const partnerEnabled = Boolean(input.adminPortal?.enabled);
  const referralHandoffEnabled = Boolean(input.adminPortal?.referralEnabled);
  const ssoConfigured = Boolean(input.adminPortal?.partnerPortalSsoSecret?.trim());
  const adminUrlConfigured = Boolean(
    (input.adminPortalUrl ?? input.adminPortal?.adminPortalUrl)?.trim(),
  );

  const serverEnabled = Boolean(input.publicCircleServer?.enabled);
  const serverUrlConfigured = Boolean(
    (input.serverBaseUrl ?? input.publicCircleServer?.serverBaseUrl)?.trim(),
  );
  const internalApiKeyConfigured = Boolean(input.publicCircleServer?.internalApiKey?.trim());

  const referralBackendKeyConfigured = Boolean(input.adminPortal?.referralBackendApiKeyConfigured);

  const partnerHandoffReady =
    partnerEnabled && referralHandoffEnabled && adminUrlConfigured && ssoConfigured;

  const serverIntegrationReady = serverEnabled && serverUrlConfigured && internalApiKeyConfigured;

  const sections: IntegrationDocSection[] = [
    {
      id: 'partner-handoff',
      title: 'Partner admin portal handoff (API key)',
      summary:
        'Lets sales and marketing partners open the Public Circle Admin support inbox from the Venndii Referral App without a separate password.',
      relatedUrlField: 'adminPortalUrl',
      prerequisites: [
        'Partner API key must be identical in Public Circle Admin and Venndii Referral App → Integrations.',
        'Partner handoff must be enabled in both admin and referral app.',
        'Referral partners are blocked from password login on the admin login page.',
      ],
      configRequirements: [
        {
          key: 'enabled',
          label: 'Enable partner handoff (admin portal)',
          required: true,
          configured: partnerEnabled,
        },
        {
          key: 'referralEnabled',
          label: 'Enable partner handoff (referral app)',
          required: true,
          configured: referralHandoffEnabled,
          hint: 'Configured in Venndii Referral App → Integrations.',
        },
        {
          key: 'adminPortalUrl',
          label: 'Admin portal URL',
          required: true,
          configured: adminUrlConfigured,
          hint: 'Public origin of this admin app (no trailing path).',
        },
        {
          key: 'partnerPortalSsoSecret',
          label: 'Partner API key',
          required: true,
          configured: ssoConfigured,
          hint: 'Shared API key used to sign and verify the 120s handoff JWT.',
        },
      ],
      flow: [
        {
          step: 1,
          actor: 'partner-user',
          description: 'Partner clicks the sidebar handoff link in the Venndii Referral App.',
        },
        {
          step: 2,
          actor: 'venndii-referral-app',
          description: 'Browser calls the referral API to mint a short-lived handoff token.',
        },
        {
          step: 3,
          actor: 'venndii-referral-be',
          description: 'Signs a JWT with purpose partner_admin_handoff using the shared API key.',
        },
        {
          step: 4,
          actor: 'venndii-referral-app',
          description: 'Opens a new tab to Public Circle Admin /auth/partner?handoff=…',
        },
        {
          step: 5,
          actor: 'public-circle-admin',
          description: 'Verifies the token, issues an admin session cookie, redirects to partner inbox.',
        },
      ],
      apis: [
        api(
          'handoff-mint',
          'venndii-referral-app',
          'POST',
          referralApiDocBase,
          '/auth/admin-portal-handoff',
          'Bearer referral access token (partner role)',
          'Create a 120-second handoff JWT for the logged-in partner.',
          'Partner clicks Support & Customers (or custom sidebar label).',
        ),
        api(
          'handoff-redirect',
          'venndii-referral-app',
          'GET',
          adminPortalUrl,
          '/auth/partner?handoff={handoffToken}',
          'handoff query param (signed JWT)',
          'Browser redirect that completes partner sign-in and sets admin_token cookie.',
          'Immediately after handoff token is returned.',
        ),
        api(
          'handoff-api',
          'public-circle-admin',
          'POST',
          adminPortalUrl,
          '/api/auth/partner-handoff',
          'JSON body: { handoffToken }',
          'Programmatic handoff variant (same verification as /auth/partner).',
          'Optional — used by embedded flows, not the default sidebar link.',
        ),
        api(
          'integrations-read',
          'venndii-referral-be',
          'GET',
          referralApiDocBase,
          '/integrations',
          'Super-admin referral JWT',
          'Read shared Integration-Settings (including partner API key) from referral app UI.',
          'Super admin opens Venndii Referral App → Integrations.',
        ),
        api(
          'integrations-write',
          'public-circle-admin',
          'PUT',
          adminPortalUrl,
          '/api/integrations',
          'Super-admin admin session',
          'Persist partner handoff settings to the shared Integration-Settings document.',
          'Super admin saves Integrations on this page.',
        ),
      ],
    },
    {
      id: 'referral-backend',
      title: 'Venndii Referral API (via admin)',
      summary:
        'The referral backend calls this admin app for partner badge counts and signup provisioning. Admin reads support stats from MongoDB and proxies provisioning to Public Circle server.',
      relatedUrlField: 'adminPortalUrl',
      prerequisites: [
        'Referral backend API key must be set in Integrations below.',
        'Venndii Referral App must not configure or call Public Circle server directly.',
      ],
      configRequirements: [
        {
          key: 'adminPortalUrl',
          label: 'Admin portal URL',
          required: true,
          configured: adminUrlConfigured,
        },
        {
          key: 'referralBackendApiKey',
          label: 'Referral backend API key',
          required: true,
          configured: referralBackendKeyConfigured,
          hint: 'Sent as X-Referral-Backend-Api-Key from the referral API.',
        },
      ],
      flow: [
        {
          step: 1,
          actor: 'venndii-referral-app',
          description: 'Partner dashboard polls the referral API for support badge counts.',
        },
        {
          step: 2,
          actor: 'venndii-referral-be',
          description: 'Calls admin internal APIs with the referral backend API key.',
        },
        {
          step: 3,
          actor: 'public-circle-admin',
          description: 'Reads partner stats from MongoDB or proxies provisioning to Public Circle server.',
        },
      ],
      apis: [
        api(
          'partner-stats-fe',
          'venndii-referral-app',
          'GET',
          referralApiDocBase,
          '/auth/partner-support-stats',
          'Bearer referral access token (partner role)',
          'Unread chat messages and open support request counts for sidebar badges.',
          'Partner dashboard polling.',
        ),
        api(
          'partner-stats-internal',
          'venndii-referral-be',
          'GET',
          adminPortalUrl,
          '/api/internal/referral/partner-support-stats/{referralUserId}',
          'X-Referral-Backend-Api-Key',
          'Server-to-server partner stats (MongoDB in admin).',
          'Referral API handles /auth/partner-support-stats.',
        ),
        api(
          'provision-internal',
          'venndii-referral-be',
          'POST',
          adminPortalUrl,
          '/api/internal/referral/third-party-users/provision',
          'X-Referral-Backend-Api-Key + JSON { referralUserId }',
          'Admin provisions third-party user in Public Circle after referral signup.',
          'Referral signup completion queue job.',
        ),
      ],
    },
    {
      id: 'public-circle-server',
      title: 'Public Circle server (admin proxy)',
      summary:
        'Server URL and internal API key are used by this admin app when proxying ticket updates and third-party user provisioning. The referral app never calls these routes directly.',
      relatedUrlField: 'serverBaseUrl',
      prerequisites: [
        'Server base URL must point to the Public Circle API origin.',
        'Internal API key must match the key configured on the Public Circle server.',
        'Public Circle Admin reads support tickets directly from MongoDB for stats and inbox lists.',
      ],
      configRequirements: [
        {
          key: 'enabled',
          label: 'Enable server integration',
          required: true,
          configured: serverEnabled,
        },
        {
          key: 'serverBaseUrl',
          label: 'Server base URL',
          required: true,
          configured: serverUrlConfigured,
        },
        {
          key: 'internalApiKey',
          label: 'Internal API key',
          required: true,
          configured: internalApiKeyConfigured,
          hint: 'Sent as X-Internal-API-Key on server /internal/* routes.',
        },
      ],
      flow: [
        {
          step: 1,
          actor: 'public-circle-admin',
          description: 'Admin proxies provisioning and ticket mutations to Public Circle server internal routes.',
        },
        {
          step: 2,
          actor: 'public-circle-server',
          description: 'Executes provision, chat, and ticket update operations.',
        },
      ],
      apis: [
        api(
          'provision-user',
          'public-circle-admin',
          'POST',
          serverBaseUrl,
          '/internal/third-party-users/provision',
          'X-Internal-API-Key (proxied from admin internal referral route)',
          'Create or sync third-party user in Public Circle after referral signup.',
          'Referral signup → referral API → admin internal route → server.',
        ),
      ],
    },
    {
      id: 'admin-support',
      title: 'Public Circle Admin support access',
      summary:
        'How this admin app loads and updates support data for internal admins and handed-off partners.',
      relatedUrlField: 'adminPortalUrl',
      prerequisites: [
        'MONGODB_URI must point to the main Public Circle database (support tickets).',
        'REFERRAL_APP_MONGODB_URL must point to the referral database (partner accounts).',
        'Partner sessions are scoped to tickets linked to their referral customers.',
      ],
      configRequirements: [
        {
          key: 'mongodb',
          label: 'Main MongoDB connection',
          required: true,
          configured: true,
          hint: 'Configured via server environment — not stored in Integration-Settings.',
        },
        {
          key: 'referralDb',
          label: 'Referral MongoDB connection',
          required: true,
          configured: true,
          hint: 'Used to resolve referral partner accounts on handoff.',
        },
      ],
      flow: [
        {
          step: 1,
          actor: 'public-circle-admin',
          description: 'Admin or partner loads dashboard; support stats are queried from MongoDB.',
        },
        {
          step: 2,
          actor: 'public-circle-admin',
          description: 'Ticket detail updates may proxy to Public Circle server internal routes.',
        },
      ],
      apis: [
        api(
          'support-stats',
          'public-circle-admin',
          'GET',
          adminPortalUrl,
          '/api/support-stats',
          'admin_token session cookie',
          'Unread messages and open ticket counts for admin or partner nav badges.',
          'Dashboard layout polling.',
        ),
        api(
          'support-list',
          'public-circle-admin',
          'GET',
          adminPortalUrl,
          '/api/support-requests',
          'admin_token session cookie',
          'List support tickets (MongoDB for partners; scoped by referral linkage).',
          'Support inbox page.',
        ),
        api(
          'support-patch',
          'public-circle-admin',
          'PATCH',
          serverBaseUrl,
          '/internal/support-requests/{id}',
          'X-Internal-API-Key (proxied from admin API route)',
          'Update ticket status, assignment, and admin notes.',
          'Admin actions on a support ticket.',
        ),
        api(
          'support-chat',
          'public-circle-admin',
          'GET',
          serverBaseUrl,
          '/internal/support-requests/{id}/chat',
          'X-Internal-API-Key (proxied from admin API route)',
          'Load chat messages for a support ticket.',
          'Opening ticket conversation view.',
        ),
      ],
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    bases: {
      adminPortalUrl,
      serverBaseUrl,
    },
    sections: sections.map((section) => ({
      ...section,
      prerequisites: [
        ...section.prerequisites,
        ...(section.id === 'partner-handoff' && !partnerHandoffReady
          ? ['⚠ Partner handoff is not fully configured yet — see requirements below.']
          : []),
        ...(section.id === 'referral-backend' &&
        (!adminUrlConfigured || !referralBackendKeyConfigured)
          ? ['⚠ Referral backend connection is not fully configured — set the API key below.']
          : []),
        ...(section.id === 'public-circle-server' && !serverIntegrationReady
          ? ['⚠ Server integration is not fully configured yet — see requirements below.']
          : []),
      ],
    })),
  };
}
