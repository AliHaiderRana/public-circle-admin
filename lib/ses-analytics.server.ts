import {
  GetAccountSendingEnabledCommand,
  GetSendQuotaCommand,
  GetSendStatisticsCommand,
  SESClient,
  type SendDataPoint,
} from '@aws-sdk/client-ses';

const CACHE_TTL_MS = 2 * 60 * 1000;

export type SesDailyStat = {
  date: string;
  deliveryAttempts: number;
  bounces: number;
  complaints: number;
  rejects: number;
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
  generatedAt: string;
};

let cache: { data: SesAnalytics; cachedAt: number } | null = null;
let refreshInFlight: Promise<SesAnalytics> | null = null;

function createClient(): { client: SESClient; region: string } | null {
  const region = (
    process.env.AWS_SES_REGION ||
    process.env.AWS_REGION ||
    'us-east-1'
  ).trim();
  const accessKeyId = (process.env.AWS_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (process.env.AWS_SECRET_ACCESS_KEY || '').trim();
  if (!accessKeyId || !secretAccessKey) return null;
  return {
    client: new SESClient({ region, credentials: { accessKeyId, secretAccessKey } }),
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

async function fetchSesAnalytics(): Promise<SesAnalytics> {
  const cfg = createClient();
  if (!cfg) {
    throw new Error('AWS credentials are not configured (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)');
  }

  const { client, region } = cfg;

  const [quotaRes, statsRes, enabledRes] = await Promise.all([
    client.send(new GetSendQuotaCommand({})),
    client.send(new GetSendStatisticsCommand({})),
    client.send(new GetAccountSendingEnabledCommand({})),
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
    generatedAt: new Date().toISOString(),
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
