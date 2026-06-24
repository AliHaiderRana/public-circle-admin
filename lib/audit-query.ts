/** Shared query parsing for admin audit list APIs. */

export type AuditSortOrder = 'desc' | 'asc';

export function parseAuditSortOrder(value: string | null): AuditSortOrder {
  return value === 'asc' ? 'asc' : 'desc';
}

export function buildAuditDateFilter(
  dateFrom: string,
  dateTo: string
): Record<string, Date> | null {
  const range: Record<string, Date> = {};
  if (dateFrom) {
    const start = new Date(`${dateFrom}T00:00:00.000Z`);
    if (!Number.isNaN(start.getTime())) {
      range.$gte = start;
    }
  }
  if (dateTo) {
    const end = new Date(`${dateTo}T23:59:59.999Z`);
    if (!Number.isNaN(end.getTime())) {
      range.$lte = end;
    }
  }
  return Object.keys(range).length ? range : null;
}

export function escapeRegexEmail(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidAuditDate(value: string): boolean {
  return ISO_DATE_RE.test(value);
}

/** YYYY-MM month keys overlapping an inclusive audit date range. */
export function enumerateMonthsInRange(dateFrom: string, dateTo: string): string[] {
  const start = dateFrom
    ? new Date(`${dateFrom}T00:00:00.000Z`)
    : dateTo
      ? new Date(`${dateTo}T00:00:00.000Z`)
      : null;
  const end = dateTo
    ? new Date(`${dateTo}T23:59:59.999Z`)
    : dateFrom
      ? new Date(`${dateFrom}T23:59:59.999Z`)
      : null;

  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return [];
  }
  if (start > end) return [];

  const months: string[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const endMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

  while (cursor <= endMonth) {
    months.push(
      `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`
    );
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return months;
}

export function matchesAuditDateRange(
  isoDate: string,
  dateFrom: string,
  dateTo: string
): boolean {
  const ts = new Date(isoDate).getTime();
  if (Number.isNaN(ts)) return false;

  if (dateFrom) {
    const start = new Date(`${dateFrom}T00:00:00.000Z`).getTime();
    if (ts < start) return false;
  }
  if (dateTo) {
    const end = new Date(`${dateTo}T23:59:59.999Z`).getTime();
    if (ts > end) return false;
  }
  return true;
}

export function formatAuditDateRangeLabel(dateFrom: string, dateTo: string): string {
  if (dateFrom && dateTo) return `${dateFrom} – ${dateTo}`;
  if (dateFrom) return `from ${dateFrom}`;
  if (dateTo) return `until ${dateTo}`;
  return 'Select date range';
}
