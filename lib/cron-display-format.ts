const CRON_SCHEDULE_DESCRIPTIONS: Record<string, string> = {
  "*/1 * * * *": "Every minute",
  "*/10 * * * *": "Every 10 minutes",
  "0 0 * * *": "Daily at 12 AM (midnight)",
  "0 0 0 * * *": "Daily at 12 AM (midnight)",
  "0 1 * * *": "Daily at 1 AM",
  "0 4 * * *": "Daily at 4 AM",
  "0 6 * * *": "Daily at 6 AM",
  "0 0,12 * * *": "Twice daily (12 AM & 12 PM)",
  "0 3 * * 0": "Weekly on Sunday at 3 AM",
  "30 2 * * *": "Daily at 2:30 AM",
  "0 0 1 * * *": "Monthly on the 1st at 1 AM",
  "15 2 * * *": "Daily at 2:15 AM",
};

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
