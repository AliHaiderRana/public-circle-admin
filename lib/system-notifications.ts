export type AdminRecipient = {
  email: string;
  name?: string;
  isSuperAdmin: boolean;
};

export type TeamRecipient = {
  email: string;
  source: string;
};

export type SystemNotificationSettings = {
  supportNotificationEmail: string | null;
  supportSendAlertEmail: boolean;
  supportSendDetailEmail: boolean;
  supportSendCustomerConfirmation: boolean;
  supportNotifySuperAdmins: boolean;
  supportNotifyAdmins: boolean;
};

export const serializeSystemNotificationSettings = (config: {
  supportNotificationEmail?: string | null;
  supportSendAlertEmail?: boolean;
  supportSendDetailEmail?: boolean;
  supportSendCustomerConfirmation?: boolean;
  supportNotifySuperAdmins?: boolean;
  supportNotifyAdmins?: boolean;
  supportAlertEmails?: string[];
  supportDetailEmails?: string[];
}): SystemNotificationSettings => {
  const legacyEmail =
    config.supportNotificationEmail?.trim() ||
    config.supportAlertEmails?.[0]?.trim() ||
    config.supportDetailEmails?.[0]?.trim() ||
    null;

  return {
    supportNotificationEmail: legacyEmail,
    supportSendAlertEmail: config.supportSendAlertEmail !== false,
    supportSendDetailEmail: config.supportSendDetailEmail !== false,
    supportSendCustomerConfirmation: config.supportSendCustomerConfirmation !== false,
    supportNotifySuperAdmins: config.supportNotifySuperAdmins !== false,
    supportNotifyAdmins: config.supportNotifyAdmins !== false,
  };
};

export const computeTeamRecipients = ({
  supportNotificationEmail,
  supportNotifySuperAdmins,
  supportNotifyAdmins,
  adminRecipients,
}: {
  supportNotificationEmail: string | null;
  supportNotifySuperAdmins: boolean;
  supportNotifyAdmins: boolean;
  adminRecipients: AdminRecipient[];
}): TeamRecipient[] => {
  const seen = new Set<string>();
  const rows: TeamRecipient[] = [];

  const add = (email: string, source: string) => {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !normalized.includes('@') || seen.has(normalized)) return;
    seen.add(normalized);
    rows.push({ email: normalized, source });
  };

  if (supportNotificationEmail?.trim()) {
    add(supportNotificationEmail, 'Support inbox');
  }

  for (const admin of adminRecipients) {
    if (admin.isSuperAdmin && supportNotifySuperAdmins) {
      add(admin.email, 'Super admin');
    } else if (!admin.isSuperAdmin && supportNotifyAdmins) {
      add(admin.email, 'Admin');
    }
  }

  return rows;
};
