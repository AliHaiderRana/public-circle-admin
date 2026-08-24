const UNITS: { limitSeconds: number; divisor: number; label: string }[] = [
  { limitSeconds: 60, divisor: 1, label: 'second' },
  { limitSeconds: 60 * 60, divisor: 60, label: 'minute' },
  { limitSeconds: 60 * 60 * 24, divisor: 60 * 60, label: 'hour' },
  { limitSeconds: 60 * 60 * 24 * 30, divisor: 60 * 60 * 24, label: 'day' },
  { limitSeconds: 60 * 60 * 24 * 365, divisor: 60 * 60 * 24 * 30, label: 'month' },
];

/** "2 hours ago", "1 day ago", "1 month ago" — falls back to years beyond that. */
export function formatTimeAgo(input: string | Date | null | undefined): string {
  if (!input) return '—';
  const date = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return '—';

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return 'Just now';

  for (const { limitSeconds, divisor, label } of UNITS) {
    if (seconds < limitSeconds) {
      const value = Math.floor(seconds / divisor);
      return `${value} ${label}${value === 1 ? '' : 's'} ago`;
    }
  }

  const years = Math.floor(seconds / (60 * 60 * 24 * 365));
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

const SHORT_UNITS: { limitSeconds: number; divisor: number; label: string }[] = [
  { limitSeconds: 60, divisor: 1, label: 's' },
  { limitSeconds: 60 * 60, divisor: 60, label: 'm' },
  { limitSeconds: 60 * 60 * 24, divisor: 60 * 60, label: 'h' },
  { limitSeconds: 60 * 60 * 24 * 30, divisor: 60 * 60 * 24, label: 'd' },
  { limitSeconds: 60 * 60 * 24 * 365, divisor: 60 * 60 * 24 * 30, label: 'mo' },
];

/** "6d ago", "19h ago" — same breakpoints as formatTimeAgo, for tight spaces like grid tiles. */
export function formatTimeAgoShort(input: string | Date | null | undefined): string {
  if (!input) return '—';
  const date = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return '—';

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return 'now';

  for (const { limitSeconds, divisor, label } of SHORT_UNITS) {
    if (seconds < limitSeconds) {
      return `${Math.floor(seconds / divisor)}${label} ago`;
    }
  }

  const years = Math.floor(seconds / (60 * 60 * 24 * 365));
  return `${years}y ago`;
}
