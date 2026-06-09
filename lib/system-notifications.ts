export type AdminRecipient = {
  id: string;
  email: string;
  name?: string;
  isSuperAdmin: boolean;
  notifySupportAlertEmail: boolean;
};

export type TeamRecipient = {
  email: string;
  source: string;
};

export type SystemNotificationSettings = {
  supportSendAlertEmail: boolean;
};

export type AdminNotificationPreferenceUpdate = {
  adminId: string;
  notifySupportAlertEmail?: boolean;
  /** @deprecated Use notifySupportAlertEmail */
  notifySupportEmail?: boolean;
};

const resolveAdminAlertPreference = (
  prefs:
    | {
        supportEmail?: boolean;
        supportAlertEmail?: boolean;
      }
    | undefined,
): boolean => {
  if (prefs?.supportEmail === false) return false;
  if (typeof prefs?.supportAlertEmail === 'boolean') return prefs.supportAlertEmail;
  return true;
};

export const serializeSystemNotificationSettings = (config: {
  supportSendAlertEmail?: boolean;
}): SystemNotificationSettings => ({
  supportSendAlertEmail: config.supportSendAlertEmail !== false,
});

export const serializeAdminRecipient = (admin: {
  _id: { toString(): string } | string;
  email: string;
  name?: string;
  isSuperAdmin?: boolean;
  notificationPreferences?: {
    supportEmail?: boolean;
    supportAlertEmail?: boolean;
  };
}): AdminRecipient => ({
  id: typeof admin._id === 'string' ? admin._id : admin._id.toString(),
  email: admin.email,
  name: admin.name,
  isSuperAdmin: Boolean(admin.isSuperAdmin),
  notifySupportAlertEmail: resolveAdminAlertPreference(admin.notificationPreferences),
});

export const computeTeamRecipients = ({
  supportSendAlertEmail,
  adminRecipients,
}: {
  supportSendAlertEmail: boolean;
  adminRecipients: AdminRecipient[];
}): TeamRecipient[] => {
  if (!supportSendAlertEmail) return [];

  return adminRecipients
    .filter((admin) => admin.notifySupportAlertEmail)
    .map((admin) => ({
      email: admin.email.trim().toLowerCase(),
      source: admin.isSuperAdmin ? 'Super admin' : 'Admin',
    }));
};
