import CronHistory from '@/lib/models/CronHistory';
import { ADMIN_LOCAL_CRON_DEFINITIONS } from '@/lib/admin-cron-definitions';
import dbConnect from '@/lib/db';

export async function getAdminLocalCronsForApi() {
  await dbConnect();

  const historyAgg = await CronHistory.aggregate<{
    _id: string;
    lastRunAt: Date;
    lastRecordsUpdated: number;
    lastDurationMs: number;
    lastError: string | null;
  }>([
    { $match: { endTime: { $ne: null } } },
    { $sort: { cronName: 1, createdAt: -1 } },
    {
      $group: {
        _id: '$cronName',
        lastRunAt: { $first: '$endTime' },
        lastRecordsUpdated: { $first: '$recordsUpdated' },
        lastDurationMs: { $first: '$duration' },
        lastError: { $first: '$error' },
      },
    },
  ]);

  const historyByName = new Map(historyAgg.map((row) => [row._id, row]));

  return ADMIN_LOCAL_CRON_DEFINITIONS.map((cron) => {
    const history = historyByName.get(cron.name);

    return {
      _id: `admin:${cron.name}`,
      name: cron.name,
      displayName: cron.displayName,
      schedule: cron.schedule,
      description: cron.description,
      lastRunAt: history?.lastRunAt ?? null,
      lastRecordsUpdated: history?.lastRecordsUpdated ?? 0,
      lastDurationMs:
        typeof history?.lastDurationMs === 'number' ? history.lastDurationMs : null,
      lastError: history?.lastError ?? null,
      isEnabled: true,
      source: 'admin' as const,
    };
  });
}
