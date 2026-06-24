import { NextResponse } from 'next/server';
import { requireSuperAdminSession } from '@/lib/auth';
import { downloadJsonFromS3 } from '@/lib/s3-json';
import {
  ADMIN_AUDIT_CATEGORY_LABELS,
  ADMIN_AUDIT_CATEGORY,
} from '@/lib/admin-audit.constants';
import {
  formatImpersonationDisplaySummary,
  IMPERSONATION_ACTIVITY_CATEGORY_LABELS,
} from '@/lib/impersonation-activity-labels';
import type { UnifiedActivityRow } from '@/lib/unified-admin-activity';
import {
  enumerateMonthsInRange,
  isValidAuditDate,
  matchesAuditDateRange,
  parseAuditSortOrder,
} from '@/lib/audit-query';

type ArchivePayload = {
  collection?: string;
  period?: string;
  totalRecords?: number;
  archivedAt?: string;
  items?: Record<string, unknown>[];
};

const ARCHIVE_PREFIX = 'admin-activity-archives';
const MAX_WAREHOUSE_MONTHS = 24;

function normalizeSource(raw: string): 'all' | 'admin_panel' | 'public_circle' {
  if (raw === 'admin_panel' || raw === 'public_circle') return raw;
  return 'all';
}

function parseCategoryFilter(
  raw: string,
  source: 'all' | 'admin_panel' | 'public_circle'
): { panelCategory?: string; pcCategory?: string } {
  const category = raw.trim();
  if (!category || category === 'all') return {};
  if (category.startsWith('panel:')) return { panelCategory: category.slice('panel:'.length) };
  if (category.startsWith('pc:')) return { pcCategory: category.slice('pc:'.length) };
  if (source === 'admin_panel') return { panelCategory: category };
  if (source === 'public_circle') return { pcCategory: category };
  return {};
}

function isValidMonth(month: string): boolean {
  return /^\d{4}-\d{2}$/.test(month);
}

function resolveWarehouseDateRange(searchParams: URLSearchParams): {
  dateFrom: string;
  dateTo: string;
  error?: string;
} {
  const dateFrom = (searchParams.get('dateFrom') || '').trim();
  const dateTo = (searchParams.get('dateTo') || '').trim();
  const month = (searchParams.get('month') || '').trim();

  let effectiveFrom = dateFrom;
  let effectiveTo = dateTo;

  if (month && isValidMonth(month) && !dateFrom && !dateTo) {
    const [year, monthNum] = month.split('-').map(Number);
    const lastDay = new Date(year, monthNum, 0).getDate();
    effectiveFrom = `${month}-01`;
    effectiveTo = `${month}-${String(lastDay).padStart(2, '0')}`;
  }

  if (!effectiveFrom && !effectiveTo) {
    return { dateFrom: '', dateTo: '', error: 'dateFrom or dateTo is required' };
  }
  if (effectiveFrom && !isValidAuditDate(effectiveFrom)) {
    return { dateFrom: '', dateTo: '', error: 'dateFrom must be in YYYY-MM-DD format' };
  }
  if (effectiveTo && !isValidAuditDate(effectiveTo)) {
    return { dateFrom: '', dateTo: '', error: 'dateTo must be in YYYY-MM-DD format' };
  }
  if (effectiveFrom && effectiveTo && effectiveFrom > effectiveTo) {
    return { dateFrom: '', dateTo: '', error: 'dateFrom must be on or before dateTo' };
  }

  return { dateFrom: effectiveFrom, dateTo: effectiveTo };
}

function mapPanelItem(row: Record<string, unknown>): UnifiedActivityRow {
  const category = String(row.category ?? 'other');
  return {
    id: `s3:panel:${String(row._id ?? Math.random())}`,
    source: 'admin_panel',
    adminEmail: String(row.adminEmail ?? ''),
    adminName: String(row.adminName ?? ''),
    summary: String(row.summary ?? 'Admin panel action'),
    category,
    categoryLabel: ADMIN_AUDIT_CATEGORY_LABELS[category as ADMIN_AUDIT_CATEGORY] ?? category,
    createdAt: new Date(String(row.createdAt ?? new Date().toISOString())).toISOString(),
    details:
      row.details && typeof row.details === 'object' && !Array.isArray(row.details)
        ? (row.details as Record<string, unknown>)
        : null,
    actorWasSuperAdmin: Boolean(row.actorWasSuperAdmin),
    action: typeof row.action === 'string' ? row.action : undefined,
    resourceType: row.resourceType != null ? String(row.resourceType) : null,
    resourceId: row.resourceId != null ? String(row.resourceId) : null,
  };
}

function mapPcItem(row: Record<string, unknown>): UnifiedActivityRow {
  const metadata =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : null;
  const requestBody =
    row.requestBody && typeof row.requestBody === 'object' && !Array.isArray(row.requestBody)
      ? (row.requestBody as Record<string, unknown>)
      : null;
  const query =
    row.query && typeof row.query === 'object' && !Array.isArray(row.query)
      ? (row.query as Record<string, unknown>)
      : null;
  const type = String(row.type ?? '');
  const category =
    typeof metadata?.category === 'string' ? metadata.category : type.toLowerCase();
  const path = row.path != null ? String(row.path) : null;
  const summaryRaw = row.summary != null ? String(row.summary) : null;

  const summary =
    formatImpersonationDisplaySummary({
      summary: summaryRaw,
      path,
      type,
      method: row.method != null ? String(row.method) : null,
      metadata,
      requestBody,
    }) || summaryRaw || type;

  return {
    id: `s3:pc:${String(row._id ?? Math.random())}`,
    source: 'public_circle',
    adminEmail: String(row.adminEmail ?? ''),
    adminName: String(row.adminName ?? ''),
    summary,
    category,
    categoryLabel:
      IMPERSONATION_ACTIVITY_CATEGORY_LABELS[category] ??
      (type === 'SESSION_START' || type === 'SESSION_END' ? 'Session' : category),
    createdAt: new Date(String(row.createdAt ?? new Date().toISOString())).toISOString(),
    details: null,
    sessionId: String(row.sessionId ?? ''),
    impersonatedUserEmail: String(row.impersonatedUserEmail ?? ''),
    impersonatedUserId: String(row.impersonatedUserId ?? ''),
    companyId: String(row.companyId ?? ''),
    activityType: type,
    method: row.method != null ? String(row.method) : null,
    path,
    statusCode: typeof row.statusCode === 'number' ? row.statusCode : null,
    metadata,
    requestBody,
    query,
  };
}

function filterPanelItem(
  item: Record<string, unknown>,
  opts: {
    adminEmail: string;
    panelCategory?: string;
    dateFrom: string;
    dateTo: string;
  }
): boolean {
  const email = String(item.adminEmail ?? '').toLowerCase();
  if (opts.adminEmail && email !== opts.adminEmail) return false;
  if (opts.panelCategory && String(item.category ?? '') !== opts.panelCategory) return false;
  const createdAt = String(item.createdAt ?? '');
  if (!matchesAuditDateRange(createdAt, opts.dateFrom, opts.dateTo)) return false;
  return true;
}

function filterPcItem(
  item: Record<string, unknown>,
  opts: {
    adminEmail: string;
    pcCategory?: string;
    dateFrom: string;
    dateTo: string;
  }
): boolean {
  const email = String(item.adminEmail ?? '').toLowerCase();
  if (opts.adminEmail && email !== opts.adminEmail) return false;
  const metadata =
    item.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata)
      ? (item.metadata as Record<string, unknown>)
      : null;
  const inferredCategory =
    typeof metadata?.category === 'string'
      ? metadata.category
      : String(item.type ?? '').toLowerCase();
  if (opts.pcCategory && inferredCategory !== opts.pcCategory) return false;
  const createdAt = String(item.createdAt ?? '');
  if (!matchesAuditDateRange(createdAt, opts.dateFrom, opts.dateTo)) return false;
  return true;
}

export async function GET(request: Request) {
  const { error } = await requireSuperAdminSession();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const { dateFrom, dateTo, error: rangeError } = resolveWarehouseDateRange(searchParams);
    if (rangeError) {
      return NextResponse.json({ error: rangeError }, { status: 400 });
    }

    const months = enumerateMonthsInRange(dateFrom, dateTo);
    if (!months.length) {
      return NextResponse.json({ error: 'Could not resolve warehouse months for date range' }, { status: 400 });
    }
    if (months.length > MAX_WAREHOUSE_MONTHS) {
      return NextResponse.json(
        { error: `Date range spans more than ${MAX_WAREHOUSE_MONTHS} months. Narrow the range.` },
        { status: 400 }
      );
    }

    const source = normalizeSource((searchParams.get('source') || 'all').trim());
    const summaryOnly = searchParams.get('summaryOnly') === '1';
    const adminEmail = (searchParams.get('adminEmail') || '').trim().toLowerCase();
    const category = (searchParams.get('category') || 'all').trim();
    const sort = parseAuditSortOrder(searchParams.get('sort'));
    const { panelCategory, pcCategory } = parseCategoryFilter(category, source);

    const includePanel = source !== 'public_circle';
    const includePc = source !== 'admin_panel';

    const panelPayloads = includePanel
      ? await Promise.all(
          months.map((month) =>
            downloadJsonFromS3<ArchivePayload>({
              s3Path: `${ARCHIVE_PREFIX}/${month}/admin-panel-activities.json`,
            })
          )
        )
      : [];
    const pcPayloads = includePc
      ? await Promise.all(
          months.map((month) =>
            downloadJsonFromS3<ArchivePayload>({
              s3Path: `${ARCHIVE_PREFIX}/${month}/impersonation-activities.json`,
            })
          )
        )
      : [];

    const panelItems = panelPayloads.flatMap((payload) => payload?.items || []).filter((item) =>
      filterPanelItem(item, { adminEmail, panelCategory, dateFrom, dateTo })
    );

    const pcItems = pcPayloads.flatMap((payload) => payload?.items || []).filter((item) =>
      filterPcItem(item, { adminEmail, pcCategory, dateFrom, dateTo })
    );

    const activities = [
      ...panelItems.map(mapPanelItem),
      ...pcItems.map(mapPcItem),
    ].sort((a, b) => {
      const delta = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sort === 'asc' ? delta : -delta;
    });

    if (summaryOnly) {
      return NextResponse.json({
        dateFrom,
        dateTo,
        months,
        summary: {
          totalStored: activities.length,
          panelStored: panelItems.length,
          publicCircleStored: pcItems.length,
          panelArchivedAt: null,
          publicCircleArchivedAt: null,
        },
      });
    }

    return NextResponse.json({
      dateFrom,
      dateTo,
      months,
      activities,
      counts: {
        total: activities.length,
        panel: panelItems.length,
        publicCircle: pcItems.length,
      },
    });
  } catch (err) {
    console.error('[admin-unified-activities/archived]', err);
    return NextResponse.json({ error: 'Failed to load warehouse activity from S3' }, { status: 500 });
  }
}
