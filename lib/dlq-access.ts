export const SUPER_ADMIN_DLQ_CRON_NAMES = ['getDlqInfo', 'redriveDlq'] as const;

export type SuperAdminDlqCronName = (typeof SUPER_ADMIN_DLQ_CRON_NAMES)[number];

export function isSuperAdminDlqCron(name: string): name is SuperAdminDlqCronName {
  return (SUPER_ADMIN_DLQ_CRON_NAMES as readonly string[]).includes(name);
}

export function canAccessDlqAdminTools(isSuperAdmin?: boolean | null) {
  return Boolean(isSuperAdmin);
}

export function filterCronsForAdminSession<
  T extends { name: string; superAdminOnly?: boolean },
>(crons: T[], isSuperAdmin?: boolean | null): T[] {
  return crons.filter((cron) => !cron.superAdminOnly || Boolean(isSuperAdmin));
}

export function assertSuperAdminDlqAccess(
  resourceName: string,
  isSuperAdmin?: boolean | null,
): { allowed: true } | { allowed: false; error: string } {
  if (!isSuperAdminDlqCron(resourceName)) {
    return { allowed: true };
  }

  if (!canAccessDlqAdminTools(isSuperAdmin)) {
    return {
      allowed: false,
      error: 'Only super admins can access DLQ tools',
    };
  }

  return { allowed: true };
}
