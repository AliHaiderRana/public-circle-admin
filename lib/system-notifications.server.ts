import dbConnect from '@/lib/db';
import AppConfig from '@/lib/models/AppConfig';
import AdminUser from '@/lib/models/AdminUser';
import {
  serializeAdminRecipient,
  serializeSystemNotificationSettings,
  computeSupportRecipients,
  computeDlqRecipients,
  type AdminNotificationPreferenceUpdate,
  type SystemNotificationSettings,
} from '@/lib/system-notifications';

export type SystemNotificationsPayload = SystemNotificationSettings & {
  adminRecipients: ReturnType<typeof serializeAdminRecipient>[];
  supportRecipients: ReturnType<typeof computeSupportRecipients>;
  dlqRecipients: ReturnType<typeof computeDlqRecipients>;
  /** @deprecated Use supportRecipients */
  teamRecipients: ReturnType<typeof computeSupportRecipients>;
};

async function loadAdminRecipients() {
  const admins = await AdminUser.find({})
    .select(
      'email name isSuperAdmin notificationPreferences.supportEmail notificationPreferences.supportAlertEmail notificationPreferences.dlqAlertEmail',
    )
    .sort({ isSuperAdmin: -1, email: 1 })
    .lean();

  return admins.map(serializeAdminRecipient);
}

function buildPayload(
  settings: SystemNotificationSettings,
  adminRecipients: ReturnType<typeof serializeAdminRecipient>[],
): SystemNotificationsPayload {
  const supportRecipients = computeSupportRecipients({
    ...settings,
    adminRecipients,
  });
  const dlqRecipients = computeDlqRecipients({
    ...settings,
    adminRecipients,
  });

  return {
    ...settings,
    adminRecipients,
    supportRecipients,
    dlqRecipients,
    teamRecipients: supportRecipients,
  };
}

export async function getSystemNotifications(): Promise<SystemNotificationsPayload> {
  await dbConnect();

  let config = await AppConfig.findOne();
  if (!config) {
    config = await AppConfig.create({});
  }

  const settings = serializeSystemNotificationSettings(config);
  const adminRecipients = await loadAdminRecipients();
  return buildPayload(settings, adminRecipients);
}

export async function updateSystemNotifications(body: {
  supportSendAlertEmail?: boolean;
  dlqSendAlertEmail?: boolean;
  adminPreferences?: AdminNotificationPreferenceUpdate[];
}) {
  await dbConnect();

  const { supportSendAlertEmail, dlqSendAlertEmail, adminPreferences } = body;

  let config = await AppConfig.findOne();
  if (!config) {
    config = await AppConfig.create({});
  }

  if (typeof supportSendAlertEmail === 'boolean') {
    config.supportSendAlertEmail = supportSendAlertEmail;
  }
  if (typeof dlqSendAlertEmail === 'boolean') {
    config.dlqSendAlertEmail = dlqSendAlertEmail;
  }
  await config.save();

  if (Array.isArray(adminPreferences)) {
    await Promise.all(
      adminPreferences.map(async (pref) => {
        if (!pref?.adminId) return;

        const update: Record<string, boolean> = {};

        if (typeof pref.notifySupportAlertEmail === 'boolean') {
          update['notificationPreferences.supportAlertEmail'] = pref.notifySupportAlertEmail;
        } else if (typeof pref.notifySupportEmail === 'boolean') {
          update['notificationPreferences.supportEmail'] = pref.notifySupportEmail;
          update['notificationPreferences.supportAlertEmail'] = pref.notifySupportEmail;
        }

        if (typeof pref.notifyDlqAlertEmail === 'boolean') {
          update['notificationPreferences.dlqAlertEmail'] = pref.notifyDlqAlertEmail;
        }

        if (!Object.keys(update).length) return;

        await AdminUser.findByIdAndUpdate(pref.adminId, { $set: update });
      }),
    );
  }

  const settings = serializeSystemNotificationSettings(config);
  const adminRecipients = await loadAdminRecipients();
  return buildPayload(settings, adminRecipients);
}
