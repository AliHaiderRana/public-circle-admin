/** Client-safe — do not import Mongoose */

export const DEFAULT_LOCALE = 'en-US';

/** First key segment — must match public-circle/docs/I18N_STRATEGY.md */
export const TRANSLATION_PREFIXES = [
  { id: 'all', label: 'All' },
  { id: 'global', label: 'Global' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'campaign', label: 'Campaigns' },
  { id: 'logs', label: 'Campaign logs' },
  { id: 'template', label: 'Templates' },
  { id: 'audience', label: 'Audience' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'config', label: 'Settings' },
  { id: 'auth', label: 'Auth' },
  { id: 'profile', label: 'Profile' },
  { id: 'public', label: 'Public site' },
  { id: 'error', label: 'Errors' },
  { id: 'common', label: 'Common' },
] as const;

/** Lowercase dot keys; segments may include underscores (e.g. global.account.org_settings). */
export const TRANSLATION_KEY_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

export const LOCALE_CODE_PATTERN = /^[a-z]{2}(-[A-Z]{2})?$/;

export const TRANSLATION_PAGE_SIZES = [10, 20, 30, 50] as const;

export const TRANSLATION_KEY_EXAMPLES = [
  'dashboard.welcome.subtitle',
  'campaign.list.title',
  'sidebar.audience.fields',
  'auth.signin.button',
];

export type SupportedLocaleOption = {
  code: string;
  label: string;
  short: string;
  enabled?: boolean;
  isDefault?: boolean;
};
