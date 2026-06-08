/** Client-safe audit constants (no Mongoose / Node-only imports). */

export const ADMIN_AUDIT_CATEGORY = {
  CUSTOMER_REQUEST: 'customer_request',
  COMPANY: 'company',
  TEMPLATE: 'template',
  TEMPLATE_CATEGORY: 'template_category',
  PLAN: 'plan',
  CRON: 'cron',
  TRANSLATION: 'translation',
  CONTEXT_HELP: 'context_help',
  ADMIN_USER: 'admin_user',
  SYSTEM_CONFIG: 'system_config',
  IMPERSONATION: 'impersonation',
  SUPPORT_REQUEST: 'support_request',
  SUPPORT_SETTINGS: 'support_settings',
  SYSTEM_NOTIFICATIONS: 'system_notifications',
} as const;

export type AdminAuditCategory =
  (typeof ADMIN_AUDIT_CATEGORY)[keyof typeof ADMIN_AUDIT_CATEGORY];

export const ADMIN_AUDIT_ACTION = {
  CUSTOMER_REQUEST_STATUS: 'customer_request.status_update',
  COMPANY_BLOCK: 'company.block',
  COMPANY_UNBLOCK: 'company.unblock',
  PLAN_QUOTA_UPDATE: 'plan.quota_update',
  CRON_TRIGGER: 'cron.trigger',
  CRON_SEED: 'cron.seed',
  TRANSLATION_CREATE: 'translation.create',
  TRANSLATION_UPDATE: 'translation.update',
  TRANSLATION_DELETE: 'translation.delete',
  LOCALE_CREATE: 'locale.create',
  LOCALE_UPDATE: 'locale.update',
  LOCALE_DELETE: 'locale.delete',
  TRANSLATION_CONFIG_UPDATE: 'translation.config_update',
  UI_TERM_UPSERT: 'ui_term.upsert',
  UI_TERM_DELETE: 'ui_term.delete',
  SAMPLE_TEMPLATE_CREATE: 'sample_template.create',
  SAMPLE_TEMPLATE_UPDATE: 'sample_template.update',
  SAMPLE_TEMPLATE_DELETE: 'sample_template.delete',
  SAMPLE_TEMPLATE_ARCHIVE: 'sample_template.archive',
  SAMPLE_TEMPLATE_UNARCHIVE: 'sample_template.unarchive',
  TEMPLATE_CATEGORY_CREATE: 'template_category.create',
  TEMPLATE_CATEGORY_UPDATE: 'template_category.update',
  TEMPLATE_CATEGORY_DELETE: 'template_category.delete',
  ADMIN_USER_CREATE: 'admin_user.create',
  ADMIN_USER_DELETE: 'admin_user.delete',
  ADMIN_PROFILE_UPDATE: 'admin_user.profile_update',
  SYSTEM_CONFIG_UPDATE: 'system_config.update',
  IMPERSONATE_START: 'impersonation.start',
  SUPPORT_REQUEST_UPDATE: 'support_request.update',
  SUPPORT_SETTINGS_UPDATE: 'support_settings.update',
  SYSTEM_NOTIFICATIONS_UPDATE: 'system_notifications.update',
  SAMPLE_TEMPLATE_TEST_EMAIL: 'sample_template.test_email',
  EDITOR_ASSET_UPLOAD: 'editor_asset.upload',
  EDITOR_ASSET_ACTIVATE: 'editor_asset.activate',
  EDITOR_ASSET_DELETE: 'editor_asset.delete',
} as const;

export type AdminAuditAction =
  (typeof ADMIN_AUDIT_ACTION)[keyof typeof ADMIN_AUDIT_ACTION];

export type AdminAuditSession = {
  userId: string;
  email: string;
  name?: string;
  isSuperAdmin?: boolean;
};

export const ADMIN_AUDIT_CATEGORY_LABELS: Record<string, string> = {
  [ADMIN_AUDIT_CATEGORY.CUSTOMER_REQUEST]: 'Customer request',
  [ADMIN_AUDIT_CATEGORY.COMPANY]: 'Company',
  [ADMIN_AUDIT_CATEGORY.TEMPLATE]: 'Sample template',
  [ADMIN_AUDIT_CATEGORY.TEMPLATE_CATEGORY]: 'Template category',
  [ADMIN_AUDIT_CATEGORY.PLAN]: 'Plan quota',
  [ADMIN_AUDIT_CATEGORY.CRON]: 'Cron job',
  [ADMIN_AUDIT_CATEGORY.TRANSLATION]: 'Translation',
  [ADMIN_AUDIT_CATEGORY.CONTEXT_HELP]: 'Context help',
  [ADMIN_AUDIT_CATEGORY.ADMIN_USER]: 'Admin user',
  [ADMIN_AUDIT_CATEGORY.SYSTEM_CONFIG]: 'System config',
  [ADMIN_AUDIT_CATEGORY.IMPERSONATION]: 'Impersonation',
  [ADMIN_AUDIT_CATEGORY.SUPPORT_REQUEST]: 'Support request',
  [ADMIN_AUDIT_CATEGORY.SUPPORT_SETTINGS]: 'Support request settings',
  [ADMIN_AUDIT_CATEGORY.SYSTEM_NOTIFICATIONS]: 'System notifications',
};
