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
  return 'All data warehouse records';
}

function formatAuditDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Last calendar day stored only in S3 warehouse (older than retention window). */
export function getWarehouseArchiveEndDate(retentionMonths = 6): string {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setMonth(cutoff.getMonth() - retentionMonths);
  const archiveEnd = new Date(cutoff);
  archiveEnd.setDate(archiveEnd.getDate() - 1);
  return formatAuditDate(archiveEnd);
}

/** First calendar day kept in live MongoDB (within retention window). */
export function getLiveActivityStartDate(retentionMonths = 6): string {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setMonth(cutoff.getMonth() - retentionMonths);
  return formatAuditDate(cutoff);
}

export function normalizeWarehouseDateBounds(
  dateFrom: string,
  dateTo: string,
  retentionMonths = 6
): { dateFrom: string; dateTo: string } {
  const today = formatAuditDate(new Date());
  let from = dateFrom.trim();
  let to = dateTo.trim();

  if (!from && !to) {
    return {
      dateFrom: '2020-01-01',
      dateTo: getWarehouseArchiveEndDate(retentionMonths),
    };
  }
  if (!from) from = '2020-01-01';
  if (!to) to = today;

  if (from > to) {
    return { dateFrom: to, dateTo: from };
  }

  return { dateFrom: from, dateTo: to };
}

export function splitWarehouseAndLiveRanges(
  dateFrom: string,
  dateTo: string,
  retentionMonths = 6
): {
  warehouse: { dateFrom: string; dateTo: string } | null;
  live: { dateFrom: string; dateTo: string } | null;
} {
  const liveStart = getLiveActivityStartDate(retentionMonths);
  const archiveEnd = getWarehouseArchiveEndDate(retentionMonths);

  let warehouse: { dateFrom: string; dateTo: string } | null = null;
  let live: { dateFrom: string; dateTo: string } | null = null;

  if (dateFrom <= archiveEnd) {
    warehouse = {
      dateFrom,
      dateTo: dateTo <= archiveEnd ? dateTo : archiveEnd,
    };
  }
  if (dateTo >= liveStart) {
    live = {
      dateFrom: dateFrom >= liveStart ? dateFrom : liveStart,
      dateTo,
    };
  }

  return { warehouse, live };
}

/** Full S3 warehouse span for "load all" — from earliest archive through retention cutoff. */
export function getFullWarehouseDateRange(retentionMonths = 6): { dateFrom: string; dateTo: string } {
  return {
    dateFrom: '2020-01-01',
    dateTo: getWarehouseArchiveEndDate(retentionMonths),
  };
}
