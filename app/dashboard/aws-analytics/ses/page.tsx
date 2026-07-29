'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  AlertTriangle,
  CheckCircle2,
  Gauge,
  Info,
  Mail,
  MailWarning,
  RefreshCw,
  Send,
  ShieldAlert,
  XCircle,
  Zap,
} from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { cn } from '@/lib/utils';
import { formatCompactCount, formatCount } from '../../db-analytics/format';

type SesDailyStat = {
  date: string;
  deliveryAttempts: number;
  bounces: number;
  complaints: number;
  rejects: number;
};

type SesAnalytics = {
  region: string;
  sendingEnabled: boolean;
  max24HourSend: number;
  maxSendRate: number;
  sentLast24Hours: number;
  remaining: number | null;
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

type ChartMetric = 'deliveryAttempts' | 'bounces' | 'complaints' | 'rejects';

const COLUMN_INFO = {
  date: 'Calendar day (UTC) aggregated from SES 15-minute send statistics.',
  deliveryAttempts: 'Emails SES attempted to deliver that day.',
  bounces: 'Hard/soft bounces reported that day.',
  complaints: 'Spam complaints reported that day.',
  rejects: 'Messages rejected by SES before sending (e.g. suppressed addresses).',
} as const;

const METRIC_OPTIONS: {
  value: ChartMetric;
  label: string;
  short: string;
}[] = [
  { value: 'deliveryAttempts', label: 'Deliveries', short: 'Deliveries' },
  { value: 'bounces', label: 'Bounces', short: 'Bounces' },
  { value: 'complaints', label: 'Complaints', short: 'Complaints' },
  { value: 'rejects', label: 'Rejects', short: 'Rejects' },
];

const volumeChartConfig = {
  deliveryAttempts: {
    label: 'Deliveries',
    color: 'var(--chart-1)',
  },
  bounces: {
    label: 'Bounces',
    color: 'var(--chart-4)',
  },
  complaints: {
    label: 'Complaints',
    color: 'var(--chart-5)',
  },
  rejects: {
    label: 'Rejects',
    color: 'var(--chart-3)',
  },
} satisfies ChartConfig;

const reputationChartConfig = {
  bounceRate: {
    label: 'Bounce rate',
    color: 'var(--chart-4)',
  },
  complaintRate: {
    label: 'Complaint rate',
    color: 'var(--chart-5)',
  },
} satisfies ChartConfig;

function HeaderWithInfo({ label, info }: { label: string; info: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="cursor-help" aria-label={`About ${label}`}>
            <Info className="h-3 w-3 text-muted-foreground/70" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-64 text-xs">
          {info}
        </TooltipContent>
      </Tooltip>
    </span>
  );
}

function usageTone(percent: number | null): 'ok' | 'warn' | 'risk' {
  if (percent == null) return 'ok';
  if (percent >= 90) return 'risk';
  if (percent >= 70) return 'warn';
  return 'ok';
}

function formatDayLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function rateStatus(
  bounceRate: number | null,
  complaintRate: number | null
): 'Healthy' | 'Warning' | 'Account at risk' {
  const b = bounceRate ?? 0;
  const c = complaintRate ?? 0;
  if (b > 10 || c > 0.5) return 'Account at risk';
  if (b > 5 || c > 0.1) return 'Warning';
  return 'Healthy';
}

export default function SesAnalyticsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<SesAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<ChartMetric>('deliveryAttempts');

  useEffect(() => {
    if (!authLoading && user && !user.isSuperAdmin) {
      router.replace('/dashboard');
    }
  }, [authLoading, user, router]);

  const fetchAnalytics = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/aws-analytics/ses${forceRefresh ? '?refresh=1' : ''}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load SES analytics');
      setData(json);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Failed to load SES analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user?.isSuperAdmin) {
      void fetchAnalytics();
    }
  }, [authLoading, user, fetchAnalytics]);

  const tone = usageTone(data?.usagePercent ?? null);

  const chartData = useMemo(
    () =>
      (data?.dailyStats ?? []).map((d) => {
        const bounceRate =
          d.deliveryAttempts > 0 ? (d.bounces / d.deliveryAttempts) * 100 : 0;
        const complaintRate =
          d.deliveryAttempts > 0 ? (d.complaints / d.deliveryAttempts) * 100 : 0;
        return {
          ...d,
          label: formatDayLabel(d.date),
          bounceRate: Number(bounceRate.toFixed(3)),
          complaintRate: Number(complaintRate.toFixed(4)),
        };
      }),
    [data]
  );

  const bounceRate14d = useMemo(() => {
    const attempts = data?.totalsLast14Days.deliveryAttempts ?? 0;
    const bounces = data?.totalsLast14Days.bounces ?? 0;
    if (attempts <= 0) return null;
    return (bounces / attempts) * 100;
  }, [data]);

  const complaintRate14d = useMemo(() => {
    const attempts = data?.totalsLast14Days.deliveryAttempts ?? 0;
    const complaints = data?.totalsLast14Days.complaints ?? 0;
    if (attempts <= 0) return null;
    return (complaints / attempts) * 100;
  }, [data]);

  const reputation = rateStatus(bounceRate14d, complaintRate14d);

  const metricPeak = useMemo(() => {
    if (!chartData.length) return 0;
    return Math.max(...chartData.map((d) => d[metric]));
  }, [chartData, metric]);

  const metricTotal = useMemo(() => {
    if (!data) return 0;
    const map = {
      deliveryAttempts: data.totalsLast14Days.deliveryAttempts,
      bounces: data.totalsLast14Days.bounces,
      complaints: data.totalsLast14Days.complaints,
      rejects: data.totalsLast14Days.rejects,
    } as const;
    return map[metric];
  }, [data, metric]);

  if (authLoading || !user?.isSuperAdmin) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-52" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight">
            <Mail className="size-5 text-muted-foreground" />
            AWS SES Analytics
            {data?.region && (
              <Badge variant="outline" className="font-mono text-xs font-normal">
                {data.region}
              </Badge>
            )}
            {data && (
              <Badge
                variant="outline"
                className={cn(
                  'gap-1 text-xs font-normal',
                  data.sendingEnabled
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400'
                    : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400'
                )}
              >
                {data.sendingEnabled ? (
                  <CheckCircle2 className="size-3" />
                ) : (
                  <XCircle className="size-3" />
                )}
                {data.sendingEnabled ? 'Sending enabled' : 'Sending paused'}
              </Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            Account sending quota, rate limits, and recent delivery statistics.
            {data?.generatedAt &&
              ` Snapshot taken ${new Date(data.generatedAt).toLocaleTimeString()} · cached up to 2 min.`}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 shrink-0"
          onClick={() => void fetchAnalytics(true)}
          disabled={loading}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Couldn’t load SES analytics</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>{error}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => void fetchAnalytics()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {data && !data.sendingEnabled && (
            <Alert variant="destructive">
              <ShieldAlert className="size-4" />
              <AlertTitle>Account sending is paused</AlertTitle>
              <AlertDescription>
                Amazon SES is not accepting send requests for this account. Check the SES console
                for pause reasons (reputation, bounce/complaint thresholds, or manual pause).
              </AlertDescription>
            </Alert>
          )}

          {/* KPI strip */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="gap-0 py-0 shadow-sm">
              <CardHeader className="border-b py-3 px-4 [.border-b]:pb-3">
                <CardDescription className="flex items-center gap-1.5 text-xs">
                  <Send className="size-3.5" />
                  Sent (last 24h)
                </CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums tracking-tight">
                  {loading ? (
                    <Skeleton className="h-7 w-24" />
                  ) : (
                    formatCount(Math.round(data?.sentLast24Hours ?? 0))
                  )}
                </CardTitle>
              </CardHeader>
              <CardFooter className="px-4 py-2.5 text-xs text-muted-foreground">
                {loading
                  ? '…'
                  : data?.unlimited
                    ? 'Unlimited daily quota'
                    : `of ${formatCount(Math.round(data?.max24HourSend ?? 0))} quota`}
              </CardFooter>
            </Card>

            <Card className="gap-0 py-0 shadow-sm">
              <CardHeader className="border-b py-3 px-4 [.border-b]:pb-3">
                <CardDescription className="flex items-center gap-1.5 text-xs">
                  <Gauge className="size-3.5" />
                  24h sending quota
                </CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums tracking-tight">
                  {loading ? (
                    <Skeleton className="h-7 w-24" />
                  ) : data?.unlimited ? (
                    'Unlimited'
                  ) : (
                    formatCount(Math.round(data?.max24HourSend ?? 0))
                  )}
                </CardTitle>
              </CardHeader>
              <CardFooter className="px-4 py-2.5 text-xs text-muted-foreground">
                {loading
                  ? '…'
                  : data && !data.unlimited && data.remaining != null
                    ? `${formatCount(Math.round(data.remaining))} remaining`
                    : 'Rolling 24-hour window'}
              </CardFooter>
            </Card>

            <Card className="gap-0 py-0 shadow-sm">
              <CardHeader className="border-b py-3 px-4 [.border-b]:pb-3">
                <CardDescription className="flex items-center gap-1.5 text-xs">
                  <Zap className="size-3.5" />
                  Max send rate
                </CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums tracking-tight">
                  {loading ? (
                    <Skeleton className="h-7 w-16" />
                  ) : data ? (
                    <>
                      {data.maxSendRate % 1 === 0
                        ? data.maxSendRate
                        : data.maxSendRate.toFixed(1)}
                      <span className="text-base font-medium text-muted-foreground">/s</span>
                    </>
                  ) : (
                    '—'
                  )}
                </CardTitle>
              </CardHeader>
              <CardFooter className="px-4 py-2.5 text-xs text-muted-foreground">
                Emails SES will accept per second
              </CardFooter>
            </Card>

            <Card className="gap-0 py-0 shadow-sm">
              <CardHeader className="border-b py-3 px-4 [.border-b]:pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardDescription className="flex items-center gap-1.5 text-xs">
                    <MailWarning className="size-3.5" />
                    Reputation (14d)
                  </CardDescription>
                  {!loading && (
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] font-normal',
                        reputation === 'Healthy' &&
                          'border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-400',
                        reputation === 'Warning' &&
                          'border-amber-200 text-amber-700 dark:border-amber-900 dark:text-amber-400',
                        reputation === 'Account at risk' &&
                          'border-red-200 text-red-700 dark:border-red-900 dark:text-red-400'
                      )}
                    >
                      {reputation}
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-2xl font-semibold tabular-nums tracking-tight">
                  {loading ? (
                    <Skeleton className="h-7 w-20" />
                  ) : bounceRate14d != null ? (
                    `${bounceRate14d.toFixed(2)}%`
                  ) : (
                    '—'
                  )}
                </CardTitle>
              </CardHeader>
              <CardFooter className="px-4 py-2.5 text-xs text-muted-foreground">
                Bounce rate
                {complaintRate14d != null
                  ? ` · complaint ${complaintRate14d.toFixed(3)}%`
                  : ''}
              </CardFooter>
            </Card>
          </div>

          {/* Quota hero */}
          <Card className="gap-0 py-0 shadow-sm overflow-hidden">
            <CardHeader className="border-b py-4 px-4 sm:px-6 [.border-b]:pb-4">
              <CardTitle className="text-base">24-hour quota usage</CardTitle>
              <CardDescription>
                Rolling window — SES checks how many emails you sent in the previous 24 hours.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 p-4 sm:p-6">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ) : data?.unlimited ? (
                <Empty className="border-0 py-6 md:p-6">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Gauge />
                    </EmptyMedia>
                    <EmptyTitle>Unlimited quota</EmptyTitle>
                    <EmptyDescription>
                      This SES account has no 24-hour sending cap.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <>
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-3xl font-semibold tabular-nums tracking-tight">
                        {formatCount(Math.round(data?.sentLast24Hours ?? 0))}
                        <span className="text-lg font-normal text-muted-foreground">
                          {' '}
                          / {formatCount(Math.round(data?.max24HourSend ?? 0))}
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatCount(Math.round(data?.remaining ?? 0))} emails remaining today
                      </p>
                    </div>
                    <div
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium tabular-nums',
                        tone === 'risk' &&
                          'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400',
                        tone === 'warn' &&
                          'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400',
                        tone === 'ok' && 'border-border bg-muted/40 text-foreground'
                      )}
                    >
                      {tone !== 'ok' && <AlertTriangle className="size-3.5" />}
                      {(data?.usagePercent ?? 0).toFixed(1)}% used
                    </div>
                  </div>
                  <Progress
                    value={data?.usagePercent ?? 0}
                    className={cn(
                      'h-3',
                      tone === 'risk' && 'bg-red-100 [&>div]:bg-red-500 dark:bg-red-950',
                      tone === 'warn' && 'bg-amber-100 [&>div]:bg-amber-500 dark:bg-amber-950',
                      tone === 'ok' && '[&>div]:bg-[var(--chart-2)]'
                    )}
                  />
                  <div className="grid grid-cols-3 gap-3 text-center sm:text-left">
                    <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
                      <p className="text-[11px] text-muted-foreground">Used</p>
                      <p className="text-sm font-semibold tabular-nums">
                        {formatCompactCount(Math.round(data?.sentLast24Hours ?? 0))}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
                      <p className="text-[11px] text-muted-foreground">Remaining</p>
                      <p className="text-sm font-semibold tabular-nums">
                        {formatCompactCount(Math.round(data?.remaining ?? 0))}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
                      <p className="text-[11px] text-muted-foreground">Quota</p>
                      <p className="text-sm font-semibold tabular-nums">
                        {formatCompactCount(Math.round(data?.max24HourSend ?? 0))}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Charts row */}
          <div className="grid gap-4 xl:grid-cols-5">
            <Card className="gap-0 py-0 shadow-sm xl:col-span-3">
              <CardHeader className="border-b py-4 px-4 sm:px-6 [.border-b]:pb-4">
                <CardTitle className="text-base">Sending activity</CardTitle>
                <CardDescription>
                  Last ~14 days from SES GetSendStatistics (daily totals).
                </CardDescription>
                <CardAction>
                  <ToggleGroup
                    type="single"
                    value={metric}
                    onValueChange={(v) => {
                      if (v) setMetric(v as ChartMetric);
                    }}
                    variant="outline"
                    size="sm"
                    className="flex-wrap justify-start"
                  >
                    {METRIC_OPTIONS.map((opt) => (
                      <ToggleGroupItem
                        key={opt.value}
                        value={opt.value}
                        className="px-2.5 text-xs"
                        aria-label={opt.label}
                      >
                        {opt.short}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </CardAction>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {loading ? (
                  <Skeleton className="aspect-[2/1] w-full rounded-lg" />
                ) : chartData.length === 0 ? (
                  <Empty className="min-h-[240px] border-0">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Send />
                      </EmptyMedia>
                      <EmptyTitle>No send statistics yet</EmptyTitle>
                      <EmptyDescription>
                        SES will populate this once the account starts sending mail.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {METRIC_OPTIONS.find((m) => m.value === metric)?.label} · 14-day total
                        </p>
                        <p className="text-2xl font-semibold tabular-nums tracking-tight">
                          {formatCount(metricTotal)}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Peak day {formatCompactCount(metricPeak)}
                      </p>
                    </div>
                    <ChartContainer
                      config={volumeChartConfig}
                      className="aspect-auto h-[280px] w-full"
                    >
                      <AreaChart
                        accessibilityLayer
                        data={chartData}
                        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="sesMetricFill" x1="0" y1="0" x2="0" y2="1">
                            <stop
                              offset="5%"
                              stopColor={`var(--color-${metric})`}
                              stopOpacity={0.35}
                            />
                            <stop
                              offset="95%"
                              stopColor={`var(--color-${metric})`}
                              stopOpacity={0.02}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis
                          dataKey="label"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          minTickGap={24}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          width={44}
                          allowDecimals={false}
                          tickFormatter={(v) => formatCompactCount(Number(v))}
                        />
                        <ChartTooltip
                          cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
                          content={<ChartTooltipContent indicator="line" />}
                        />
                        <Area
                          type="monotone"
                          dataKey={metric}
                          stroke={`var(--color-${metric})`}
                          fill="url(#sesMetricFill)"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4, strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ChartContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="gap-0 py-0 shadow-sm xl:col-span-2">
              <CardHeader className="border-b py-4 px-4 sm:px-6 [.border-b]:pb-4">
                <CardTitle className="text-base">Reputation rates</CardTitle>
                <CardDescription>
                  Bounce & complaint % of delivery attempts (SES thresholds: bounce 5%/10%,
                  complaint 0.1%/0.5%).
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {loading ? (
                  <Skeleton className="aspect-[4/3] w-full rounded-lg" />
                ) : chartData.length === 0 ? (
                  <Empty className="min-h-[240px] border-0">
                    <EmptyHeader>
                      <EmptyTitle>No rate data</EmptyTitle>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <ChartContainer
                    config={reputationChartConfig}
                    className="aspect-auto h-[280px] w-full"
                  >
                    <BarChart
                      accessibilityLayer
                      data={chartData}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        minTickGap={28}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        width={40}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value, name) => {
                              const isComplaint =
                                name === 'complaintRate' ||
                                String(name).toLowerCase().includes('complaint');
                              return (
                                <div className="flex flex-1 items-center justify-between gap-4 leading-none">
                                  <span className="text-muted-foreground">
                                    {isComplaint ? 'Complaint rate' : 'Bounce rate'}
                                  </span>
                                  <span className="font-mono font-medium tabular-nums text-foreground">
                                    {Number(value ?? 0).toFixed(isComplaint ? 3 : 2)}%
                                  </span>
                                </div>
                              );
                            }}
                          />
                        }
                      />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Bar
                        dataKey="bounceRate"
                        fill="var(--color-bounceRate)"
                        radius={[3, 3, 0, 0]}
                        maxBarSize={18}
                      />
                      <Bar
                        dataKey="complaintRate"
                        fill="var(--color-complaintRate)"
                        radius={[3, 3, 0, 0]}
                        maxBarSize={18}
                      />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
              {!loading && data && (
                <CardFooter className="flex flex-wrap gap-4 border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
                  <span>
                    {formatCount(data.totalsLast14Days.bounces)} bounces ·{' '}
                    {formatCount(data.totalsLast14Days.complaints)} complaints ·{' '}
                    {formatCount(data.totalsLast14Days.rejects)} rejects
                  </span>
                </CardFooter>
              )}
            </Card>
          </div>

          {/* Daily table */}
          <Card className="gap-0 py-0 shadow-sm">
            <CardHeader className="border-b py-4 px-4 sm:px-6 [.border-b]:pb-4">
              <CardTitle className="text-base">Daily breakdown</CardTitle>
              <CardDescription>
                {loading
                  ? 'Loading…'
                  : `${data?.dailyStats.length ?? 0} days · ${formatCompactCount(
                      data?.totalsLast14Days.deliveryAttempts ?? 0
                    )} delivery attempts total`}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4 sm:pl-6">
                      <HeaderWithInfo label="Date" info={COLUMN_INFO.date} />
                    </TableHead>
                    <TableHead>
                      <HeaderWithInfo
                        label="Deliveries"
                        info={COLUMN_INFO.deliveryAttempts}
                      />
                    </TableHead>
                    <TableHead>
                      <HeaderWithInfo label="Bounces" info={COLUMN_INFO.bounces} />
                    </TableHead>
                    <TableHead>
                      <HeaderWithInfo label="Complaints" info={COLUMN_INFO.complaints} />
                    </TableHead>
                    <TableHead className="pr-4 sm:pr-6">
                      <HeaderWithInfo label="Rejects" info={COLUMN_INFO.rejects} />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={5} className="py-3">
                          <Skeleton className="h-8 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (data?.dailyStats ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="p-0">
                        <Empty className="min-h-[160px] border-0">
                          <EmptyHeader>
                            <EmptyTitle>No daily statistics</EmptyTitle>
                            <EmptyDescription>
                              Nothing to show for this SES account yet.
                            </EmptyDescription>
                          </EmptyHeader>
                        </Empty>
                      </TableCell>
                    </TableRow>
                  ) : (
                    [...(data?.dailyStats ?? [])].reverse().map((row) => {
                      const dayBounce =
                        row.deliveryAttempts > 0
                          ? (row.bounces / row.deliveryAttempts) * 100
                          : 0;
                      return (
                        <TableRow key={row.date}>
                          <TableCell className="pl-4 py-2.5 text-sm sm:pl-6">
                            <div className="font-medium tabular-nums">
                              {formatDayLabel(row.date)}
                            </div>
                            <div className="font-mono text-[10px] text-muted-foreground">
                              {row.date}
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5 tabular-nums text-sm font-medium">
                            {formatCount(row.deliveryAttempts)}
                          </TableCell>
                          <TableCell className="py-2.5 text-sm">
                            <span className="tabular-nums">{formatCount(row.bounces)}</span>
                            {row.deliveryAttempts > 0 && (
                              <span className="ml-1.5 text-[10px] text-muted-foreground">
                                ({dayBounce.toFixed(2)}%)
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="py-2.5 tabular-nums text-sm">
                            {formatCount(row.complaints)}
                          </TableCell>
                          <TableCell className="pr-4 py-2.5 tabular-nums text-sm sm:pr-6">
                            {formatCount(row.rejects)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
            {!loading && data && (
              <>
                <Separator />
                <CardFooter className="px-4 py-3 text-xs text-muted-foreground sm:px-6">
                  Totals over shown period:{' '}
                  <span className="ml-1 font-medium text-foreground tabular-nums">
                    {formatCount(data.totalsLast14Days.deliveryAttempts)} deliveries
                  </span>
                  , {formatCount(data.totalsLast14Days.bounces)} bounces,{' '}
                  {formatCount(data.totalsLast14Days.complaints)} complaints,{' '}
                  {formatCount(data.totalsLast14Days.rejects)} rejects.
                </CardFooter>
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
