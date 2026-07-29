export type AdminRecipient = {
  id: string;
  email: string;
  name?: string;
  isSuperAdmin: boolean;
  notifySupportAlertEmail: boolean;
  notifyDlqAlertEmail: boolean;
  notifyDbAlertEmail: boolean;
};

export type TeamRecipient = {
  email: string;
  source: string;
};

export type SystemNotificationSettings = {
  supportSendAlertEmail: boolean;
  dlqSendAlertEmail: boolean;
  dbSendAlertEmail: boolean;
};

export type AdminNotificationPreferenceUpdate = {
  adminId: string;
  notifySupportAlertEmail?: boolean;
  notifyDlqAlertEmail?: boolean;
  notifyDbAlertEmail?: boolean;
  /** @deprecated Use notifySupportAlertEmail */
  notifySupportEmail?: boolean;
};

const resolveSupportAlertPreference = (
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

const resolveDlqAlertPreference = (
  prefs:
    | {
        dlqAlertEmail?: boolean;
      }
    | undefined,
): boolean => {
  if (typeof prefs?.dlqAlertEmail === 'boolean') return prefs.dlqAlertEmail;
  return true;
};

const resolveDbAlertPreference = (
  prefs:
    | {
        dbAlertEmail?: boolean;
      }
    | undefined,
): boolean => {
  if (typeof prefs?.dbAlertEmail === 'boolean') return prefs.dbAlertEmail;
  return true;
};

export const serializeSystemNotificationSettings = (config: {
  supportSendAlertEmail?: boolean;
  dlqSendAlertEmail?: boolean;
  dbSendAlertEmail?: boolean;
}): SystemNotificationSettings => ({
  supportSendAlertEmail: config.supportSendAlertEmail !== false,
  dlqSendAlertEmail: config.dlqSendAlertEmail !== false,
  dbSendAlertEmail: config.dbSendAlertEmail !== false,
});

export const serializeAdminRecipient = (admin: {
  _id: { toString(): string } | string;
  email: string;
  name?: string;
  isSuperAdmin?: boolean;
  notificationPreferences?: {
    supportEmail?: boolean;
    supportAlertEmail?: boolean;
    dlqAlertEmail?: boolean;
    dbAlertEmail?: boolean;
  };
}): AdminRecipient => ({
  id: typeof admin._id === 'string' ? admin._id : admin._id.toString(),
  email: admin.email,
  name: admin.name,
  isSuperAdmin: Boolean(admin.isSuperAdmin),
  notifySupportAlertEmail: resolveSupportAlertPreference(admin.notificationPreferences),
  notifyDlqAlertEmail: resolveDlqAlertPreference(admin.notificationPreferences),
  notifyDbAlertEmail: resolveDbAlertPreference(admin.notificationPreferences),
});

export const computeSupportRecipients = ({
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
      source: admin.isSuperAdmin ? 'Super admin · Support' : 'Admin · Support',
    }));
};

export const computeDlqRecipients = ({
  dlqSendAlertEmail,
  adminRecipients,
}: {
  dlqSendAlertEmail: boolean;
  adminRecipients: AdminRecipient[];
}): TeamRecipient[] => {
  if (!dlqSendAlertEmail) return [];

  return adminRecipients
    .filter((admin) => admin.notifyDlqAlertEmail)
    .map((admin) => ({
      email: admin.email.trim().toLowerCase(),
      source: admin.isSuperAdmin ? 'Super admin · DLQ' : 'Admin · DLQ',
    }));
};

export const computeDbRecipients = ({
  dbSendAlertEmail,
  adminRecipients,
}: {
  dbSendAlertEmail: boolean;
  adminRecipients: AdminRecipient[];
}): TeamRecipient[] => {
  if (!dbSendAlertEmail) return [];

  return adminRecipients
    .filter((admin) => admin.notifyDbAlertEmail)
    .map((admin) => ({
      email: admin.email.trim().toLowerCase(),
      source: admin.isSuperAdmin ? 'Super admin · DB' : 'Admin · DB',
    }));
};

/** @deprecated Use computeSupportRecipients */
export const computeTeamRecipients = computeSupportRecipients;
