import { CronJob } from 'cron';
import { runAdminLocalCronInBackground } from '@/lib/admin-cron-runner.server';

const TIMEZONE = process.env.ADMIN_CRON_TIMEZONE || 'Asia/Karachi';

let started = false;

export function registerAdminCrons() {
  if (started) return;
  // Server cron calls the admin internal API by default; enable local scheduling only when needed.
  if (process.env.ENABLE_ADMIN_LOCAL_CRONS !== '1') return;
  if (process.env.DISABLE_ADMIN_CRONS === '1') return;
  if (process.env.VERCEL) return;

  started = true;

  // Daily at 1 AM — archives activity older than 6 months
  new CronJob(
    '0 0 1 * * *',
    () => {
      console.log('[admin-cron-scheduler] Starting archiveAdminActivity');
      runAdminLocalCronInBackground('archiveAdminActivity');
    },
    null,
    true,
    TIMEZONE
  );

  // Daily at 1 AM — alerts configured recipients once cluster storage crosses 4 GB
  new CronJob(
    '0 0 1 * * *',
    () => {
      console.log('[admin-cron-scheduler] Starting dbStorageAlert');
      runAdminLocalCronInBackground('dbStorageAlert');
    },
    null,
    true,
    TIMEZONE
  );

  console.log('[admin-cron-scheduler] Registered admin local crons');
}
