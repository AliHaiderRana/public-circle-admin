import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import AdminActivity from '@/lib/models/AdminActivity';
import {
  ADMIN_AUDIT_ACTION,
  type AdminAuditAction,
  type AdminAuditCategory,
  type AdminAuditSession,
} from '@/lib/admin-audit.constants';

export {
  ADMIN_AUDIT_CATEGORY,
  ADMIN_AUDIT_ACTION,
  ADMIN_AUDIT_CATEGORY_LABELS,
  type AdminAuditCategory,
  type AdminAuditAction,
  type AdminAuditSession,
} from '@/lib/admin-audit.constants';

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'body',
  'jsonTemplate',
]);

function redactValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEYS.has(key)) {
    return '[redacted]';
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return redactDetails(value as Record<string, unknown>);
  }
  return value;
}

export function redactDetails(
  details: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!details || typeof details !== 'object') return null;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    out[key] = redactValue(key, value);
  }
  return Object.keys(out).length ? out : null;
}

const humanizeFieldName = (field: unknown) => {
  const key = String(field ?? '');
  const labels: Record<string, string> = {
    name: 'name',
    body: 'HTML content',
    categoryId: 'category',
    isPopular: 'popular flag',
    status: 'status',
    description: 'description',
    project: 'projects',
    email: 'emails',
    bandwidth: 'bandwidth',
    contact: 'contacts',
    enabled: 'enabled',
    label: 'label',
    isDefault: 'default language',
    isSignupAllowed: 'signup allowed',
    appleRelayEmail: 'Apple relay email',
    deleteCompanyContactsAfterDays: 'contact deletion retention',
    supportRequestsEnabled: 'Talk to Support enabled',
    supportNotificationEmail: 'support email',
    supportSendAlertEmail: 'support alert emails',
    dlqSendAlertEmail: 'DLQ alert emails',
    dbSendAlertEmail: 'DB storage alert emails',
    supportSendDetailEmail: 'support detail emails',
    supportSendCustomerConfirmation: 'support customer confirmation',
    supportNotifySuperAdmins: 'support super-admin notifications',
    supportNotifyAdmins: 'support admin notifications',
  };
  return labels[key] ?? key.replace(/_/g, ' ');
};

const joinList = (items: string[]) => {
  if (items.length <= 2) return items.join(' and ');
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
};

const formatFieldsChangedSuffix = (fields: unknown) => {
  if (!Array.isArray(fields) || !fields.length) return '';
  const labels = fields
    .map((f) => humanizeFieldName(f))
    .filter((f) => f.trim());
  if (!labels.length) return '';
  return ` (${joinList(labels)})`;
};

const formatQuotaChangeSuffix = (details: Record<string, unknown>) => {
  const prev = details.previousQuota as Record<string, number> | null | undefined;
  const next = details.quota as Record<string, number> | null | undefined;
  const fields = Array.isArray(details.fieldsChanged) ? details.fieldsChanged : [];
  if (!fields.length) return '';

  const parts = fields.map((field) => {
    const key = String(field);
    const label = humanizeFieldName(key);
    const before = prev?.[key];
    const after = next?.[key];
    if (before !== undefined && after !== undefined && before !== after) {
      return `${label} ${before} → ${after}`;
    }
    if (after !== undefined) return `${label} → ${after}`;
    return label;
  });

  return parts.length ? ` (${parts.join(', ')})` : '';
};

const formatImpactSuffix = (details: Record<string, unknown>) => {
  const parts: string[] = [];
  if (typeof details.usersBlocked === 'number' && details.usersBlocked > 0) {
    parts.push(`${details.usersBlocked} user${details.usersBlocked === 1 ? '' : 's'} blocked`);
  }
  if (typeof details.usersUnblocked === 'number' && details.usersUnblocked > 0) {
    parts.push(`${details.usersUnblocked} user${details.usersUnblocked === 1 ? '' : 's'} unblocked`);
  }
  if (typeof details.campaignsPaused === 'number' && details.campaignsPaused > 0) {
    parts.push(`${details.campaignsPaused} campaign${details.campaignsPaused === 1 ? '' : 's'} paused`);
  }
  return parts.length ? ` — ${joinList(parts)}` : '';
};

const companySuffix = (companyName: unknown) => {
  const name = typeof companyName === 'string' ? companyName.trim() : '';
  return name ? ` for “${name}”` : '';
};

export function buildAuditSummary(
  action: string,
  details?: Record<string, unknown> | null
): string {
  const d = details ?? {};

  const formatCustomerRequestType = (type: unknown) => {
    if (!type) return '';
    const key = String(type);
    const labels: Record<string, string> = {
      DEDICATED_IP_ENABLED: 'Dedicated IP enable',
      DEDICATED_IP_DISABLED: 'Dedicated IP disable',
      DOWNGRADE_PLAN: 'Plan downgrade',
      EDIT_CONTACTS_PRIMARY_KEY: 'Edit contacts primary key',
      EDIT_CONTACTS_EMAIL_KEY: 'Edit contacts email key',
      EDIT_CONTACTS_FILTERS: 'Edit contact filters',
      'apple-relay-email': 'Apple relay email',
      attachment: 'Attachment',
      notification: 'Notification',
    };
    return labels[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const formatStatus = (status: unknown) => {
    const key = String(status ?? 'unknown').toUpperCase();
    const labels: Record<string, string> = {
      OPEN: 'open',
      IN_PROGRESS: 'in progress',
      RESOLVED: 'resolved',
      CLOSED: 'closed',
      PENDING: 'pending',
      COMPLETED: 'completed',
      REJECTED: 'rejected',
    };
    if (labels[key]) return labels[key];
    return String(status ?? 'unknown').toLowerCase().replace(/_/g, ' ');
  };

  switch (action) {
    case ADMIN_AUDIT_ACTION.CUSTOMER_REQUEST_STATUS: {
      const typeLabel = formatCustomerRequestType(d.type);
      const companySuffix =
        typeof d.companyName === 'string' && d.companyName.trim()
          ? ` for “${d.companyName.trim()}”`
          : '';
      const previousStatus = d.previousStatus;
      const nextStatus = d.status;
      if (
        previousStatus &&
        nextStatus &&
        String(previousStatus) !== String(nextStatus)
      ) {
        const transition = `marked ${formatStatus(previousStatus)} → ${formatStatus(nextStatus)}`;
        return typeLabel
          ? `${typeLabel} request ${transition}${companySuffix}`
          : `Customer request ${transition}${companySuffix}`;
      }
      const statusLabel = formatStatus(nextStatus);
      return typeLabel
        ? `${typeLabel} request marked as ${statusLabel}${companySuffix}`
        : `Customer request marked as ${statusLabel}${companySuffix}`;
    }
    case ADMIN_AUDIT_ACTION.SUPPORT_SETTINGS_UPDATE:
      return 'Updated support request settings';
    case ADMIN_AUDIT_ACTION.SYSTEM_NOTIFICATIONS_UPDATE:
      return 'Updated system notifications';
    case ADMIN_AUDIT_ACTION.DLQ_SETTINGS_UPDATE:
      return 'Updated DLQ alert recipients';
    case ADMIN_AUDIT_ACTION.DLQ_REDRIVE: {
      const resentCount = typeof d.resentCount === 'number' ? d.resentCount : null;
      return resentCount != null
        ? `Redrove ${resentCount} DLQ message(s) back to SQS`
        : 'Triggered DLQ redrive to SQS';
    }
    case ADMIN_AUDIT_ACTION.DLQ_SYNC_FAILURES: {
      const deletedCount = typeof d.deletedCount === 'number' ? d.deletedCount : null;
      const keptCount = typeof d.keptCount === 'number' ? d.keptCount : null;
      if (deletedCount != null && keptCount != null) {
        return `Synced failure records with DLQ (deleted ${deletedCount}, kept ${keptCount})`;
      }
      return 'Synced outbound email failure records with DLQ';
    }
    case ADMIN_AUDIT_ACTION.SUPPORT_CHAT_DELETE: {
      const subject = typeof d.subject === 'string' ? d.subject.trim() : '';
      const sq = subject ? ` “${subject}”` : '';
      const messagesDeleted =
        typeof d.messagesDeleted === 'number' ? d.messagesDeleted : null;
      const attachmentsDeleted =
        typeof d.attachmentsDeleted === 'number' ? d.attachmentsDeleted : null;
      const counts =
        messagesDeleted != null
          ? ` (${messagesDeleted} message(s), ${attachmentsDeleted ?? 0} image(s) removed from S3)`
          : '';
      return d.ticketDeleted
        ? `Permanently deleted support ticket${sq}${counts}${companySuffix(d.companyName)}`
        : `Permanently deleted support chat${sq}${counts}${companySuffix(d.companyName)}`;
    }
    case ADMIN_AUDIT_ACTION.SUPPORT_MESSAGE_REPLY: {
      const subject = typeof d.subject === 'string' ? d.subject.trim() : '';
      const sq = subject ? ` “${subject}”` : '';
      const companyPart = companySuffix(d.companyName);
      const actor =
        typeof d.actorName === 'string' && d.actorName.trim()
          ? d.actorName.trim()
          : d.actorIsPartner
            ? 'Support partner'
            : 'Support admin';
      if (d.internal) {
        return `${actor} added an internal note on support request${sq}${companyPart}`;
      }
      const preview =
        typeof d.messagePreview === 'string' && d.messagePreview.trim()
          ? ` — “${d.messagePreview.trim().slice(0, 80)}${d.messagePreview.trim().length > 80 ? '…' : ''}”`
          : '';
      const attachmentSuffix = d.hasAttachment ? ' (with attachment)' : '';
      return `${actor} replied to customer on support request${sq}${preview}${attachmentSuffix}${companyPart}`;
    }
    case ADMIN_AUDIT_ACTION.SUPPORT_REQUEST_UPDATE: {
      const subject = typeof d.subject === 'string' ? d.subject.trim() : '';
      const categoryLabel =
        typeof d.categoryLabel === 'string' ? d.categoryLabel.trim() : '';
      const sq = subject ? ` “${subject}”` : '';
      const categorySuffix = categoryLabel ? ` (${categoryLabel})` : '';
      const companyPart = companySuffix(d.companyName);

      if (d.adminNotesUpdated && !d.status) {
        return `Updated admin notes on support request${sq}${categorySuffix}${companyPart}`;
      }

      const previousStatus = d.previousStatus;
      const nextStatus = d.status;
      if (
        previousStatus &&
        nextStatus &&
        String(previousStatus) !== String(nextStatus)
      ) {
        return `Support request${sq} marked ${formatStatus(previousStatus)} → ${formatStatus(nextStatus)}${categorySuffix}${companyPart}`;
      }

      if (d.adminNotesUpdated) {
        return `Updated support request${sq}${categorySuffix}${companyPart}`;
      }

      return `Support request${sq} marked as ${formatStatus(nextStatus)}${categorySuffix}${companyPart}`;
    }
    case ADMIN_AUDIT_ACTION.COMPANY_BLOCK:
      return `Blocked company${d.companyName ? ` “${d.companyName}”` : ''}${formatImpactSuffix(d)}`;
    case ADMIN_AUDIT_ACTION.COMPANY_UNBLOCK:
      return `Unblocked company${d.companyName ? ` “${d.companyName}”` : ''}${formatImpactSuffix(d)}`;
    case ADMIN_AUDIT_ACTION.COMPANY_DELETE: {
      const dbCount = typeof d.dbDocumentsDeleted === 'number' ? d.dbDocumentsDeleted : null;
      const objCount = typeof d.awsObjectsDeleted === 'number' ? d.awsObjectsDeleted : null;
      const subsCount = typeof d.stripeSubscriptionsCancelled === 'number' ? d.stripeSubscriptionsCancelled : null;
      const parts = [
        dbCount != null ? `${dbCount} document(s)` : null,
        objCount != null ? `${objCount} S3 object(s)` : null,
        subsCount != null ? `${subsCount} Stripe subscription(s)` : null,
      ].filter(Boolean);
      return `Permanently deleted company${d.companyName ? ` “${d.companyName}”` : ''}${
        parts.length ? ` (${parts.join(', ')})` : ''
      }`;
    }
    case ADMIN_AUDIT_ACTION.COMPANY_ARCHIVE: {
      const dbCount = typeof d.dbBackedUpDocuments === 'number' ? d.dbBackedUpDocuments : null;
      const objCount = typeof d.awsBackedUpObjects === 'number' ? d.awsBackedUpObjects : null;
      const subsCount = typeof d.stripeSubscriptionsCancelled === 'number' ? d.stripeSubscriptionsCancelled : null;
      const parts = [
        dbCount != null ? `${dbCount} document(s)` : null,
        objCount != null ? `${objCount} S3 object(s)` : null,
        subsCount != null ? `${subsCount} Stripe subscription(s)` : null,
      ].filter(Boolean);
      return `Archived company${d.companyName ? ` “${d.companyName}”` : ''}${
        parts.length ? ` (backed up ${parts.join(', ')})` : ''
      }`;
    }
    case ADMIN_AUDIT_ACTION.COMPANY_RESTORE: {
      const dbCount = typeof d.dbRestoredDocuments === 'number' ? d.dbRestoredDocuments : null;
      const objCount = typeof d.awsRestoredObjects === 'number' ? d.awsRestoredObjects : null;
      const subsCount = typeof d.stripeSubscriptionsCreated === 'number' ? d.stripeSubscriptionsCreated : null;
      const parts = [
        dbCount != null ? `${dbCount} document(s)` : null,
        objCount != null ? `${objCount} S3 object(s)` : null,
        subsCount != null ? `${subsCount} Stripe subscription(s)` : null,
      ].filter(Boolean);
      return `Restored archived company${d.companyName ? ` “${d.companyName}”` : ''}${
        parts.length ? ` (restored ${parts.join(', ')})` : ''
      }`;
    }
    case ADMIN_AUDIT_ACTION.ARCHIVED_COMPANY_DELETE: {
      const objCount = typeof d.awsBackupObjectsDeleted === 'number' ? d.awsBackupObjectsDeleted : null;
      return `Permanently deleted archived company${d.companyName ? ` “${d.companyName}”` : ''}${
        objCount != null ? ` (removed ${objCount} backed-up S3 object(s))` : ''
      }`;
    }
    case ADMIN_AUDIT_ACTION.PLAN_QUOTA_UPDATE:
      return `Updated plan quota${d.planName ? ` for “${d.planName}”` : ''}${formatQuotaChangeSuffix(d)}`;
    case ADMIN_AUDIT_ACTION.CRON_TRIGGER:
      return `Triggered cron job “${d.cronName ?? 'unknown'}”`;
    case ADMIN_AUDIT_ACTION.CRON_SEED:
      return 'Seeded cron job definitions';
    case ADMIN_AUDIT_ACTION.TRANSLATION_CREATE:
      return `Added translation${d.key ? ` “${d.key}”` : ''}`;
    case ADMIN_AUDIT_ACTION.TRANSLATION_UPDATE: {
      const locale =
        typeof d.locale === 'string' && d.locale.trim() ? ` [${d.locale.trim()}]` : '';
      return `Updated translation${d.key ? ` “${d.key}”` : ''}${locale}`;
    }
    case ADMIN_AUDIT_ACTION.TRANSLATION_DELETE:
      return `Deleted translation${d.key ? ` “${d.key}”` : ''}`;
    case ADMIN_AUDIT_ACTION.LOCALE_CREATE:
      return `Added language${d.code ? ` “${d.code}”` : ''}`;
    case ADMIN_AUDIT_ACTION.LOCALE_UPDATE: {
      const code = typeof d.code === 'string' ? d.code.trim() : '';
      const label = typeof d.label === 'string' ? d.label.trim() : '';
      const parts: string[] = [];
      if (d.enabled !== undefined) parts.push(d.enabled ? 'enabled' : 'disabled');
      if (d.isDefault === true) parts.push('set as default');
      if (label) parts.push(`label → “${label}”`);
      const suffix = parts.length ? ` (${parts.join(', ')})` : '';
      return `Updated language${code ? ` “${code}”` : ''}${suffix}`;
    }
    case ADMIN_AUDIT_ACTION.LOCALE_DELETE:
      return `Removed language${d.code ? ` “${d.code}”` : ''}`;
    case ADMIN_AUDIT_ACTION.TRANSLATION_CONFIG_UPDATE: {
      const changes = d.changes;
      const keys =
        changes && typeof changes === 'object' && !Array.isArray(changes)
          ? Object.keys(changes as Record<string, unknown>)
          : [];
      return keys.length
        ? `Updated translation admin settings (${joinList(keys.map(humanizeFieldName))})`
        : 'Updated translation admin settings';
    }
    case ADMIN_AUDIT_ACTION.UI_TERM_UPSERT:
      if (d.isUpdate) {
        return `Updated context help${d.key ? ` “${d.key}”` : ''}${formatFieldsChangedSuffix(d.fieldsChanged)}`;
      }
      return `Created context help${d.key ? ` “${d.key}”` : ''}`;
    case ADMIN_AUDIT_ACTION.UI_TERM_DELETE:
      return `Deleted context help${d.key ? ` “${d.key}”` : ''}`;
    case ADMIN_AUDIT_ACTION.SAMPLE_TEMPLATE_CREATE:
      return `Created sample template${d.name ? ` “${d.name}”` : ''}`;
    case ADMIN_AUDIT_ACTION.SAMPLE_TEMPLATE_UPDATE:
      return `Updated sample template${d.name ? ` “${d.name}”` : ''}${formatFieldsChangedSuffix(d.fieldsChanged)}`;
    case ADMIN_AUDIT_ACTION.SAMPLE_TEMPLATE_DELETE:
      return `Deleted sample template${d.name ? ` “${d.name}”` : ''}`;
    case ADMIN_AUDIT_ACTION.SAMPLE_TEMPLATE_ARCHIVE:
      return `Archived sample template${d.name ? ` “${d.name}”` : ''}`;
    case ADMIN_AUDIT_ACTION.SAMPLE_TEMPLATE_UNARCHIVE:
      return `Restored sample template${d.name ? ` “${d.name}”` : ''}`;
    case ADMIN_AUDIT_ACTION.TEMPLATE_CATEGORY_CREATE:
      return `Created template category${d.name ? ` “${d.name}”` : ''}`;
    case ADMIN_AUDIT_ACTION.TEMPLATE_CATEGORY_UPDATE:
      return `Updated template category${d.name ? ` “${d.name}”` : ''}${formatFieldsChangedSuffix(d.fieldsChanged)}`;
    case ADMIN_AUDIT_ACTION.TEMPLATE_CATEGORY_DELETE:
      return `Deleted template category${d.name ? ` “${d.name}”` : ''}`;
    case ADMIN_AUDIT_ACTION.ADMIN_USER_CREATE:
      return `Created admin user “${d.email ?? 'unknown'}”${
        d.isSuperAdmin ? ' (super admin)' : ''
      }`;
    case ADMIN_AUDIT_ACTION.ADMIN_USER_DELETE:
      return `Deleted admin user${d.email ? ` “${d.email}”` : ''}`;
    case ADMIN_AUDIT_ACTION.ADMIN_PROFILE_UPDATE: {
      if (d.field === 'password') {
        return 'Changed admin account password';
      }
      if (d.field === 'email' && d.previousEmail && d.email) {
        return `Changed admin profile email from “${d.previousEmail}” to “${d.email}”`;
      }
      if (d.field === 'name' && d.name) {
        return `Updated admin profile name to “${d.name}”`;
      }
      const field = humanizeFieldName(d.field);
      return `Updated admin profile ${field}`;
    }
    case ADMIN_AUDIT_ACTION.SAMPLE_TEMPLATE_TEST_EMAIL: {
      const recipients = Array.isArray(d.recipients) ? d.recipients.length : 0;
      const recipientSuffix =
        recipients > 0
          ? ` to ${recipients} recipient${recipients === 1 ? '' : 's'}`
          : '';
      const subject =
        typeof d.emailSubject === 'string' && d.emailSubject.trim()
          ? ` — “${d.emailSubject.trim()}”`
          : '';
      return `Sent sample template test email${recipientSuffix}${subject}`;
    }
    case ADMIN_AUDIT_ACTION.EDITOR_ASSET_UPLOAD:
      return `Uploaded editor asset${d.name ? ` “${d.name}”` : ''}`;
    case ADMIN_AUDIT_ACTION.EDITOR_ASSET_ACTIVATE:
      return `Activated editor asset${d.name ? ` “${d.name}”` : ''}`;
    case ADMIN_AUDIT_ACTION.EDITOR_ASSET_DELETE:
      return `Deleted editor asset${d.name ? ` “${d.name}”` : ''}`;
    case ADMIN_AUDIT_ACTION.SYSTEM_CONFIG_UPDATE: {
      const fields = Array.isArray(d.fieldsChanged)
        ? d.fieldsChanged.filter((f) => typeof f === 'string' && f.trim())
        : [];
      if (fields.length) {
        return `Updated system configuration (${fields.join(', ')})`;
      }
      return 'Updated system configuration';
    }
    case ADMIN_AUDIT_ACTION.IMPERSONATE_START: {
      const email =
        typeof d.impersonatedUserEmail === 'string' ? d.impersonatedUserEmail.trim() : '';
      const name =
        typeof d.impersonatedUserName === 'string' ? d.impersonatedUserName.trim() : '';
      const companyName =
        typeof d.companyName === 'string' ? d.companyName.trim() : '';
      const userLabel = name && email ? `${name} (${email})` : email || name || String(d.userId ?? 'user');
      const companySuffix = companyName ? ` at “${companyName}”` : '';
      const prefix = d.referralRole ? 'Partner ' : '';
      return `${prefix}started “Login as user” for ${userLabel}${companySuffix}`;
    }
    case ADMIN_AUDIT_ACTION.PARTNER_PORTAL_LOGIN:
      return 'Partner signed in to customer portal';
    case ADMIN_AUDIT_ACTION.PARTNER_PORTAL_VIEW_COMPANY:
      return typeof d.companyName === 'string' && d.companyName.trim()
        ? `Partner viewed company “${d.companyName.trim()}”`
        : 'Partner viewed company details';
    default:
      return action.replace(/\./g, ' ').replace(/_/g, ' ');
  }
}

export async function logAdminActivity(
  session: AdminAuditSession,
  entry: {
    action: AdminAuditAction | string;
    category: AdminAuditCategory;
    resourceType?: string;
    resourceId?: string;
    details?: Record<string, unknown> | null;
    summary?: string;
  }
): Promise<void> {
  if (!session?.userId || !session?.email) return;

  const details = redactDetails(entry.details ?? null);
  const summary = entry.summary ?? buildAuditSummary(entry.action, details);

  try {
    await dbConnect();
    const adminId = new mongoose.Types.ObjectId(String(session.userId));
    await AdminActivity.create({
      adminId,
      adminEmail: session.email,
      adminName: session.name ?? '',
      actorWasSuperAdmin: Boolean(session.isSuperAdmin),
      actorIsPartner: Boolean(session.isPartner),
      referralRole: session.referralRole ?? null,
      action: entry.action,
      category: entry.category,
      resourceType: entry.resourceType ?? null,
      resourceId: entry.resourceId ? String(entry.resourceId) : null,
      summary,
      details,
    });
  } catch (err) {
    console.error('[admin-audit]', err);
  }
}
