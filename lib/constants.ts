export const MODELS = {
  USER: "user",
  COMPANY_CONTACT: "company-contact",
  FILTER: "filter",
  CONFIGURATION: "configuration",
  EMAILS_SENT: "emails-sent",
  CAMPAIGN: "campaign",
  CAMPAIGN_RUN: "campaign-run",
  SEGMENT: "segment",
  TEMPLATE: "template",
  TEMPLATE_CATEGORY: "template-categories",
  DYNAMIC_TEMPLATE: "dynamic-template",
  CRON_JOB: "cron-job",
  COMPANY: "companies",
  ACCESS_TOKEN: "access-token",
  REFRESH_TOKEN: "refresh-token",
  ROLE: "role",
  SOCIAL_LINK: "social-link",
  ASSET: "asset",
  REFERRAL_CODE: "referral-code",
  REWARD: "reward",
  PLAN: "plan",
  OVERAGE_CONSUMPTION: "overage-comsumption",
  TOPUP: "topup",
  CUSTOMER_REQUESTS: "customer-requests",
  COMPANY_GROUPING: "company-grouping",
  BALANCE_DEDUCTION: "balance-deduction",
  UN_SUBSCRIBED_USERS: "un-subscribed-users",
  APP_CONFIG: "app-config",
  CAMPAIGN_RUN_STATS: "campaign-run-stats",
  APPLE_RELAY_EMAIL: "apple-relay-email",
  ATTACHMENT: "attachment",
  NOTIFICATION: "notification",
};

export const CUSTOMER_REQUEST_TYPE = {
  APPLE_RELAY_EMAIL: "apple-relay-email",
  ATTACHMENT: "attachment",
  NOTIFICATION: "notification",
  DEDICATED_IP_ENABLED: "DEDICATED_IP_ENABLED",
  DEDICATED_IP_DISABLED: "DEDICATED_IP_DISABLED",
  DOWNGRADE_PLAN: "DOWNGRADE_PLAN",
  EDIT_CONTACTS_PRIMARY_KEY: "EDIT_CONTACTS_PRIMARY_KEY",
  EDIT_CONTACTS_EMAIL_KEY: "EDIT_CONTACTS_EMAIL_KEY",
  EDIT_CONTACTS_FILTERS: "EDIT_CONTACTS_FILTERS",
};

export const CUSTOMER_REQUEST_STATUS = {
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
  REJECTED: "REJECTED",
};

export const USER_STATUS = {
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  DELETED: "DELETED",
};

export const USER_KIND = {
  PRIMARY: "PRIMARY",
  SECONDARY: "SECONDARY",
};

export const CAMPAIGN_STATUS = {
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  DRAFT: "DRAFT",
  ARCHIVED: "ARCHIVED",
};

export const SES_STATUS = {
  HEALTHY: "HEALTHY",
  WARNING: "WARNING",
  RISK: "RISK",
};
