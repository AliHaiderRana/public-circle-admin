import {
  CloudWatchClient,
  GetMetricDataCommand,
} from '@aws-sdk/client-cloudwatch';
import {
  GetAccountSendingEnabledCommand,
  GetSendQuotaCommand,
  GetSendStatisticsCommand,
  SESClient,
  type SendDataPoint,
} from '@aws-sdk/client-ses';

const CACHE_TTL_MS = 2 * 60 * 1000;
const REPUTATION_WINDOW_DAYS = 15;

export type SesDailyStat = {
  date: string;
  deliveryAttempts: number;
  bounces: number;
  complaints: number;
  rejects: number;
};

export type SesReputationPoint = {
  date: string;
  bounceRate: number | null;
  complaintRate: number | null;
};

/**
 * AWS's own account reputation metrics (CloudWatch `AWS/SES`), as shown on the
 * SES console's Reputation metrics page. These are not the same as the bounce
 * ratio derived from `GetSendStatistics`: AWS computes them over a rolling
 * "representative volume" of mail and counts only permanent bounces.
 */
export type SesReputation = {
  /** Latest reported account bounce rate, in percent (0–100). */
  bounceRate: number | null;
  /** Latest reported account complaint rate, in percent (0–100). */
  complaintRate: number | null;
  /** Timestamp of the most recent datapoint. */
  asOf: string | null;
  daily: SesReputationPoint[];
  /** Set when CloudWatch could not be queried (e.g. missing IAM permission). */
  unavailableReason: string | null;
};

export type SesAnalytics = {
  region: string;
  sendingEnabled: boolean;
  max24HourSend: number;
  maxSendRate: number;
  sentLast24Hours: number;
  /** Remaining sends in the rolling 24h window; null when quota is unlimited (-1). */
  remaining: number | null;
  /** 0–100 usage of the 24h quota; null when unlimited. */
  usagePercent: number | null;
  unlimited: boolean;
  dailyStats: SesDailyStat[];
  totalsLast14Days: {
    deliveryAttempts: number;
    bounces: number;
    complaints: number;
    rejects: number;
  };
  reputation: SesReputation;
  /** Account-wide AWS SES stats, or per-company EmailsSent aggregation. */
  scope: 'account' | 'company';
  companyId: string | null;
  companyName: string | null;
  generatedAt: string;
};

let cache: { data: SesAnalytics; cachedAt: number } | null = null;
let refreshInFlight: Promise<SesAnalytics> | null = null;

function createClient(): {
  client: SESClient;
  cloudWatch: CloudWatchClient;
  region: string;
} | null {
  const region = (
    process.env.AWS_SES_REGION ||
    process.env.AWS_REGION ||
    'us-east-1'
  ).trim();
  const accessKeyId = (process.env.AWS_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (process.env.AWS_SECRET_ACCESS_KEY || '').trim();
  if (!accessKeyId || !secretAccessKey) return null;
  const credentials = { accessKeyId, secretAccessKey };
  return {
    client: new SESClient({ region, credentials }),
    cloudWatch: new CloudWatchClient({ region, credentials }),
    region,
  };
}

function dayKey(isoOrDate: Date): string {
  return isoOrDate.toISOString().slice(0, 10);
}

function aggregateDaily(points: SendDataPoint[]): SesDailyStat[] {
  const byDay = new Map<string, SesDailyStat>();

  for (const p of points) {
    if (!p.Timestamp) continue;
    const key = dayKey(p.Timestamp);
    const existing = byDay.get(key) ?? {
      date: key,
      deliveryAttempts: 0,
      bounces: 0,
      complaints: 0,
      rejects: 0,
    };
    existing.deliveryAttempts += p.DeliveryAttempts ?? 0;
    existing.bounces += p.Bounces ?? 0;
    existing.complaints += p.Complaints ?? 0;
    existing.rejects += p.Rejects ?? 0;
    byDay.set(key, existing);
  }

  return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Reads the account-level reputation metrics SES publishes to CloudWatch. The
 * values are fractions (0–1) and are converted to percentages here. AWS
 * recommends the Maximum statistic for these metrics.
 */
async function fetchReputation(cloudWatch: CloudWatchClient): Promise<SesReputation> {
  const empty: SesReputation = {
    bounceRate: null,
    complaintRate: null,
    asOf: null,
    daily: [],
    unavailableReason: null,
  };

  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - REPUTATION_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const metricQuery = (id: string, metricName: string) => ({
    Id: id,
    MetricStat: {
      Metric: { Namespace: 'AWS/SES', MetricName: metricName },
      Period: 3600,
      Stat: 'Maximum',
    },
  });

  let res;
  try {
    res = await cloudWatch.send(
      new GetMetricDataCommand({
        StartTime: startTime,
        EndTime: endTime,
        ScanBy: 'TimestampAscending',
        MetricDataQueries: [
          metricQuery('bounce', 'Reputation.BounceRate'),
          metricQuery('complaint', 'Reputation.ComplaintRate'),
        ],
      })
    );
  } catch (err) {
    return {
      ...empty,
      unavailableReason:
        err instanceof Error ? err.message : 'Unable to read CloudWatch reputation metrics',
    };
  }

  const byDay = new Map<string, { bounceRate: number | null; complaintRate: number | null }>();
  let latestAt: Date | null = null;
  const latest: { bounceRate: number | null; complaintRate: number | null } = {
    bounceRate: null,
    complaintRate: null,
  };

  for (const result of res.MetricDataResults ?? []) {
    const field = result.Id === 'complaint' ? 'complaintRate' : 'bounceRate';
    const timestamps = result.Timestamps ?? [];
    const values = result.Values ?? [];

    for (let i = 0; i < timestamps.length; i += 1) {
      const ts = timestamps[i];
      const percent = (values[i] ?? 0) * 100;
      const key = dayKey(ts);
      const day = byDay.get(key) ?? { bounceRate: null, complaintRate: null };
      day[field] = Math.max(day[field] ?? 0, percent);
      byDay.set(key, day);

      if (!latestAt || ts > latestAt) latestAt = ts;
    }

    const lastIndex = timestamps.length - 1;
    if (lastIndex >= 0) latest[field] = (values[lastIndex] ?? 0) * 100;
  }

  if (byDay.size === 0) return empty;

  const daily = Array.from(byDay.entries())
    .map(([date, rates]) => ({ date, ...rates }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    bounceRate: latest.bounceRate,
    complaintRate: latest.complaintRate,
    asOf: latestAt ? latestAt.toISOString() : null,
    daily,
    unavailableReason: null,
  };
}

async function fetchSesAnalytics(): Promise<SesAnalytics> {
  const cfg = createClient();
  if (!cfg) {
    throw new Error('AWS credentials are not configured (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)');
  }

  const { client, cloudWatch, region } = cfg;

  const [quotaRes, statsRes, enabledRes, reputation] = await Promise.all([
    client.send(new GetSendQuotaCommand({})),
    client.send(new GetSendStatisticsCommand({})),
    client.send(new GetAccountSendingEnabledCommand({})),
    fetchReputation(cloudWatch),
  ]);

  const max24HourSend = quotaRes.Max24HourSend ?? 0;
  const maxSendRate = quotaRes.MaxSendRate ?? 0;
  const sentLast24Hours = quotaRes.SentLast24Hours ?? 0;
  const unlimited = max24HourSend < 0;

  const remaining = unlimited ? null : Math.max(0, max24HourSend - sentLast24Hours);
  const usagePercent = unlimited
    ? null
    : max24HourSend === 0
      ? 0
      : Math.min(100, (sentLast24Hours / max24HourSend) * 100);

  const rawPoints = statsRes.SendDataPoints ?? [];
  const dailyStats = aggregateDaily(rawPoints);

  const totalsLast14Days = dailyStats.reduce(
    (acc, d) => {
      acc.deliveryAttempts += d.deliveryAttempts;
      acc.bounces += d.bounces;
      acc.complaints += d.complaints;
      acc.rejects += d.rejects;
      return acc;
    },
    { deliveryAttempts: 0, bounces: 0, complaints: 0, rejects: 0 }
  );

  return {
    region,
    sendingEnabled: enabledRes.Enabled !== false,
    max24HourSend,
    maxSendRate,
    sentLast24Hours,
    remaining,
    usagePercent,
    unlimited,
    dailyStats,
    totalsLast14Days,
    reputation,
    scope: 'account',
    companyId: null,
    companyName: null,
    generatedAt: new Date().toISOString(),
  };
}

const COMPANY_WINDOW_DAYS = 14;

/**
 * Per-company daily send / bounce / complaint totals from EmailsSent (last 14 days).
 * Excludes TEST emails, matching SES health-monitor counting rules.
 */
export async function getCompanyDailySendStats(
  companyId: string
): Promise<{
  dailyStats: SesDailyStat[];
  totalsLast14Days: SesAnalytics['totalsLast14Days'];
  companyName: string | null;
}> {
  const mongoose = (await import('mongoose')).default;
  const dbConnect = (await import('@/lib/db')).default;
  const EmailsSent = (await import('@/lib/models/EmailsSent')).default;
  const Company = (await import('@/lib/models/Company')).default;

  if (!mongoose.Types.ObjectId.isValid(companyId)) {
    throw new Error('Invalid company id');
  }

  await dbConnect();

  const objectId = new mongoose.Types.ObjectId(companyId);
  const company = await Company.findById(objectId).select('name').lean<{ name?: string } | null>();
  if (!company) {
    throw new Error('Company not found');
  }

  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (COMPANY_WINDOW_DAYS - 1));

  const rows = await EmailsSent.aggregate<{
    _id: string;
    deliveryAttempts: number;
    bounces: number;
    complaints: number;
    rejects: number;
  }>([
    {
      $match: {
        company: objectId,
        kind: { $ne: 'TEST' },
        createdAt: { $gte: start },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' },
        },
        deliveryAttempts: { $sum: 1 },
        bounces: {
          $sum: { $cond: [{ $ifNull: ['$emailEvents.Bounce', false] }, 1, 0] },
        },
        complaints: {
          $sum: { $cond: [{ $ifNull: ['$emailEvents.Complaint', false] }, 1, 0] },
        },
        rejects: {
          $sum: { $cond: [{ $ifNull: ['$emailEvents.Reject', false] }, 1, 0] },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const byDay = new Map(rows.map((r) => [r._id, r]));
  const dailyStats: SesDailyStat[] = [];
  for (let i = 0; i < COMPANY_WINDOW_DAYS; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const key = dayKey(d);
    const row = byDay.get(key);
    dailyStats.push({
      date: key,
      deliveryAttempts: row?.deliveryAttempts ?? 0,
      bounces: row?.bounces ?? 0,
      complaints: row?.complaints ?? 0,
      rejects: row?.rejects ?? 0,
    });
  }

  const totalsLast14Days = dailyStats.reduce(
    (acc, d) => {
      acc.deliveryAttempts += d.deliveryAttempts;
      acc.bounces += d.bounces;
      acc.complaints += d.complaints;
      acc.rejects += d.rejects;
      return acc;
    },
    { deliveryAttempts: 0, bounces: 0, complaints: 0, rejects: 0 }
  );

  return {
    dailyStats,
    totalsLast14Days,
    companyName: company.name ?? null,
  };
}

/**
 * SES account sending quota, rate, and recent send statistics.
 * Cached for 2 minutes; pass forceRefresh to bypass.
 */
export async function getSesAnalytics(forceRefresh = false): Promise<SesAnalytics> {
  const now = Date.now();
  if (!forceRefresh && cache && now - cache.cachedAt < CACHE_TTL_MS) {
    return cache.data;
  }

  if (!forceRefresh && cache && refreshInFlight) {
    // Stale-while-revalidate: return stale immediately while a refresh runs
    return cache.data;
  }

  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = fetchSesAnalytics()
    .then((data) => {
      cache = { data, cachedAt: Date.now() };
      return data;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  if (!forceRefresh && cache) {
    void refreshInFlight;
    return cache.data;
  }

  return refreshInFlight;
}
