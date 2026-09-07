const CRON_SCHEDULE_DESCRIPTIONS: Record<string, string> = {
  "*/1 * * * *": "Every minute",
  "*/10 * * * *": "Every 10 minutes",
  "0 0 * * *": "Daily at 12 AM (midnight)",
  "0 0 0 * * *": "Daily at 12 AM (midnight)",
  "0 1 * * *": "Daily at 1 AM",
  "0 4 * * *": "Daily at 4 AM",
  "0 6 * * *": "Daily at 6 AM",
  "0 0,12 * * *": "Twice daily (12 AM & 12 PM)",
  "0 */6 * * *": "Every 6 hours",
  "0 */12 * * *": "Every 12 hours",
  "0 3 * * 0": "Weekly on Sunday at 3 AM",
  "30 2 * * *": "Daily at 2:30 AM",
  "0 0 1 * * *": "Monthly on the 1st at 1 AM",
  "15 2 * * *": "Daily at 2:15 AM",
};

function toFiniteNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function resolveCronDurationMs(
  item?: {
    duration?: number | string | null;
    startTime?: string | Date | null;
    endTime?: string | Date | null;
  } | null,
): number | null {
  if (!item) return null;

  const stored = toFiniteNumber(item.duration);
  if (stored != null && stored >= 0) return stored;

  if (!item.startTime || !item.endTime) return null;
  const start = new Date(item.startTime).getTime();
  const end = new Date(item.endTime).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return end - start;
}

export function formatCronDuration(ms: number | string | null | undefined): string {
  const value = toFiniteNumber(ms);
  if (value == null || value < 0) return "-";
  if (value < 1000) return `${Math.round(value)}ms`;
  if (value < 60000) return `${(value / 1000).toFixed(2)}s`;
  return `${(value / 60000).toFixed(2)}m`;
}

export function formatCronElapsed(
  startTime: string | Date | null | undefined,
  now = Date.now(),
): string {
  if (!startTime) return "-";
  const start = new Date(startTime).getTime();
  if (!Number.isFinite(start)) return "-";
  return formatCronDuration(Math.max(0, now - start));
}

export function formatCronDateTime(value: string | null | undefined): string {
  if (!value) return "Never";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true,
  });
}

export function getCronScheduleDescription(
  schedule?: string | null
): string {
  if (!schedule || schedule === "unknown") {
    return "Schedule not available";
  }
  return CRON_SCHEDULE_DESCRIPTIONS[schedule] || schedule;
}
