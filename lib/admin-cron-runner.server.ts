import CronHistory, { CRON_HISTORY_STATUS } from '@/lib/models/CronHistory';
import { archiveAdminActivityLogs } from '@/lib/admin-activity-archive.server';
import { checkAndSendDbStorageAlert } from '@/lib/db-storage-alert.server';
import { getAdminLocalCronDefinition } from '@/lib/admin-cron-definitions';
import dbConnect from '@/lib/db';

const CRON_HISTORY_LIMIT = 30;

async function cleanupOldHistory(cronName: string) {
  const allRecords = await CronHistory.find({ cronName })
    .sort({ createdAt: -1 })
    .select('_id')
    .lean();

  if (allRecords.length <= CRON_HISTORY_LIMIT) return;

  const recordsToDelete = allRecords.slice(CRON_HISTORY_LIMIT).map((row) => row._id);
  await CronHistory.deleteMany({ _id: { $in: recordsToDelete } });
}

export async function runAdminLocalCron(name: string) {
  const definition = getAdminLocalCronDefinition(name);
  if (!definition) {
    throw new Error(`Unknown admin cron: ${name}`);
  }

  await dbConnect();

  const startTime = new Date();
  let recordsUpdated = 0;
  let error: string | null = null;
  let errorStack: string | null = null;
  let status: (typeof CRON_HISTORY_STATUS)[keyof typeof CRON_HISTORY_STATUS] =
    CRON_HISTORY_STATUS.SUCCESS;
  let metadata: Record<string, unknown> | null = null;

  try {
    if (name === 'archiveAdminActivity') {
      const result = await archiveAdminActivityLogs();
      recordsUpdated =
        (result.panelDeleted || 0) + (result.impersonationDeleted || 0);
      metadata = result as unknown as Record<string, unknown>;

      if (result.failedMonths.length > 0) {
        error = `Partial failure for months: ${result.failedMonths.join(', ')}`;
        status = CRON_HISTORY_STATUS.FAILED;
      }
    } else if (name === 'dbStorageAlert') {
      const result = await checkAndSendDbStorageAlert();
      recordsUpdated = result.alertSent ? result.recipientCount : 0;
      metadata = result as unknown as Record<string, unknown>;

      if (result.error) {
        error = result.error;
        status = CRON_HISTORY_STATUS.FAILED;
      }
    }
  } catch (err) {
    status = CRON_HISTORY_STATUS.FAILED;
    error = err instanceof Error ? err.message : String(err);
    errorStack = err instanceof Error ? err.stack || null : null;
    throw err;
  } finally {
    const endTime = new Date();

    await CronHistory.create({
      cronName: name,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      recordsUpdated,
      status,
      error,
      errorStack,
      metadata,
    });

    await cleanupOldHistory(name);
  }

  return {
    name,
    recordsUpdated,
    durationMs: Date.now() - startTime.getTime(),
    metadata,
  };
}

export function runAdminLocalCronInBackground(name: string) {
  void runAdminLocalCron(name).catch((err) => {
    console.error(`[admin-cron] Background run failed for ${name}:`, err);
  });
}
