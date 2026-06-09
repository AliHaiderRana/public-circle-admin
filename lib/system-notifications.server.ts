import dbConnect from '@/lib/db';
import AppConfig from '@/lib/models/AppConfig';
import AdminUser from '@/lib/models/AdminUser';
import {
  serializeAdminRecipient,
  serializeSystemNotificationSettings,
  computeTeamRecipients,
  type AdminNotificationPreferenceUpdate,
  type SystemNotificationSettings,
} from '@/lib/system-notifications';

export type SystemNotificationsPayload = SystemNotificationSettings & {
  adminRecipients: ReturnType<typeof serializeAdminRecipient>[];
  teamRecipients: ReturnType<typeof computeTeamRecipients>;
};

async function loadAdminRecipients() {
  const admins = await AdminUser.find({})
    .select(
      'email name isSuperAdmin notificationPreferences.supportEmail notificationPreferences.supportAlertEmail',
    )
    .sort({ isSuperAdmin: -1, email: 1 })
    .lean();

  return admins.map(serializeAdminRecipient);
}

function buildPayload(
  settings: SystemNotificationSettings,
  adminRecipients: ReturnType<typeof serializeAdminRecipient>[],
): SystemNotificationsPayload {
  return {
    ...settings,
    adminRecipients,
    teamRecipients: computeTeamRecipients({
      ...settings,
      adminRecipients,
    }),
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
  adminPreferences?: AdminNotificationPreferenceUpdate[];
}) {
  await dbConnect();

  const { supportSendAlertEmail, adminPreferences } = body;

  let config = await AppConfig.findOne();
  if (!config) {
    config = await AppConfig.create({});
  }

  if (typeof supportSendAlertEmail === 'boolean') {
    config.supportSendAlertEmail = supportSendAlertEmail;
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

        if (!Object.keys(update).length) return;

        await AdminUser.findByIdAndUpdate(pref.adminId, { $set: update });
      }),
    );
  }

  const settings = serializeSystemNotificationSettings(config);
  const adminRecipients = await loadAdminRecipients();
  return buildPayload(settings, adminRecipients);
}
