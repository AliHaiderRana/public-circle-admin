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
