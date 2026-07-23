export type AdminCronDefinition = {
  name: string;
  displayName: string;
  schedule: string;
  description: string;
  source: 'admin';
};

export const ADMIN_LOCAL_CRON_DEFINITIONS: AdminCronDefinition[] = [
  {
    name: 'archiveAdminActivity',
    displayName: 'Archive Admin Activity',
    schedule: '0 0 1 * * *',
    description:
      'Archives admin panel and Public Circle impersonation activity older than 6 months to S3 as JSON, then removes them from MongoDB',
    source: 'admin',
  },
  {
    name: 'dbStorageAlert',
    displayName: 'DB Storage Alert',
    schedule: '0 0 1 * * *',
    description:
      'Checks total MongoDB cluster storage size and emails configured recipients once it crosses 4 GB',
    source: 'admin',
  },
];

export function getAdminLocalCronDefinition(name: string) {
  return ADMIN_LOCAL_CRON_DEFINITIONS.find((cron) => cron.name === name) ?? null;
}
