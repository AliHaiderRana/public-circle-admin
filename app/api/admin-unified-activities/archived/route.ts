import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import AdminActivity from '@/lib/models/AdminActivity';
import AdminImpersonationActivity from '@/lib/models/AdminImpersonationActivity';
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
import { fetchUnifiedAdminActivitiesInRange } from '@/lib/unified-admin-activity.server';
import {
  enumerateMonthsInRange,
  getFullWarehouseDateRange,
  isValidAuditDate,
  matchesAuditDateRange,
  normalizeWarehouseDateBounds,
  parseAuditSortOrder,
  splitWarehouseAndLiveRanges,
} from '@/lib/audit-query';
import { ADMIN_ACTIVITY_WAREHOUSE_RETENTION_MONTHS } from '@/lib/admin-audit.constants';

type ArchivePayload = {
  collection?: string;
  period?: string;
  totalRecords?: number;
  archivedAt?: string;
  items?: Record<string, unknown>[];
};

const ARCHIVE_PREFIX = 'admin-activity-archives';
const S3_FETCH_BATCH_SIZE = 6;

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
  const loadAll = searchParams.get('all') === '1';
  const dateFrom = (searchParams.get('dateFrom') || '').trim();
  const dateTo = (searchParams.get('dateTo') || '').trim();
  const month = (searchParams.get('month') || '').trim();

  if (loadAll) {
    return getFullWarehouseDateRange(ADMIN_ACTIVITY_WAREHOUSE_RETENTION_MONTHS);
  }

  if (month && isValidMonth(month) && !dateFrom && !dateTo) {
    const [year, monthNum] = month.split('-').map(Number);
    const lastDay = new Date(year, monthNum, 0).getDate();
    return {
      dateFrom: `${month}-01`,
      dateTo: `${month}-${String(lastDay).padStart(2, '0')}`,
    };
  }

  if (!dateFrom && !dateTo) {
    return getFullWarehouseDateRange(ADMIN_ACTIVITY_WAREHOUSE_RETENTION_MONTHS);
  }

  if (dateFrom && !isValidAuditDate(dateFrom)) {
    return { dateFrom: '', dateTo: '', error: 'dateFrom must be in YYYY-MM-DD format' };
  }
  if (dateTo && !isValidAuditDate(dateTo)) {
    return { dateFrom: '', dateTo: '', error: 'dateTo must be in YYYY-MM-DD format' };
  }

  return normalizeWarehouseDateBounds(
    dateFrom,
    dateTo,
    ADMIN_ACTIVITY_WAREHOUSE_RETENTION_MONTHS
  );
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

async function fetchArchivePayloads(
  months: string[],
  fileName: string
): Promise<ArchivePayload[]> {
  const payloads: ArchivePayload[] = [];

  for (let i = 0; i < months.length; i += S3_FETCH_BATCH_SIZE) {
    const batch = months.slice(i, i + S3_FETCH_BATCH_SIZE);
    const batchPayloads = await Promise.all(
      batch.map((month) =>
        downloadJsonFromS3<ArchivePayload>({
          s3Path: `${ARCHIVE_PREFIX}/${month}/${fileName}`,
        })
      )
    );
    payloads.push(...batchPayloads);
  }

  return payloads;
}

function sortActivities(
  activities: UnifiedActivityRow[],
  sort: ReturnType<typeof parseAuditSortOrder>
): UnifiedActivityRow[] {
  return [...activities].sort((a, b) => {
    const delta = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return sort === 'asc' ? delta : -delta;
  });
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

    const source = normalizeSource((searchParams.get('source') || 'all').trim());
    const summaryOnly = searchParams.get('summaryOnly') === '1';
    const adminEmail = (searchParams.get('adminEmail') || '').trim().toLowerCase();
    const category = (searchParams.get('category') || 'all').trim();
    const sort = parseAuditSortOrder(searchParams.get('sort'));
    const { panelCategory, pcCategory } = parseCategoryFilter(category, source);

    const includePanel = source !== 'public_circle';
    const includePc = source !== 'admin_panel';

    const { warehouse, live } = splitWarehouseAndLiveRanges(
      dateFrom,
      dateTo,
      ADMIN_ACTIVITY_WAREHOUSE_RETENTION_MONTHS
    );

    let panelItems: UnifiedActivityRow[] = [];
    let pcItems: UnifiedActivityRow[] = [];
    const months: string[] = [];

    if (warehouse) {
      const warehouseMonths = enumerateMonthsInRange(warehouse.dateFrom, warehouse.dateTo);
      months.push(...warehouseMonths);

      const [panelPayloads, pcPayloads] = await Promise.all([
        includePanel
          ? fetchArchivePayloads(warehouseMonths, 'admin-panel-activities.json')
          : Promise.resolve([]),
        includePc
          ? fetchArchivePayloads(warehouseMonths, 'impersonation-activities.json')
          : Promise.resolve([]),
      ]);

      panelItems = panelPayloads
        .flatMap((payload) => payload?.items || [])
        .filter((item) =>
          filterPanelItem(item, {
            adminEmail,
            panelCategory,
            dateFrom: warehouse.dateFrom,
            dateTo: warehouse.dateTo,
          })
        )
        .map(mapPanelItem);

      pcItems = pcPayloads
        .flatMap((payload) => payload?.items || [])
        .filter((item) =>
          filterPcItem(item, {
            adminEmail,
            pcCategory,
            dateFrom: warehouse.dateFrom,
            dateTo: warehouse.dateTo,
          })
        )
        .map(mapPcItem);
    }

    if (live) {
      await dbConnect();
      const liveResult = await fetchUnifiedAdminActivitiesInRange({
        AdminActivity,
        AdminImpersonationActivity,
        sort,
        source,
        adminEmail,
        dateFrom: live.dateFrom,
        dateTo: live.dateTo,
        category,
        hideNoise: true,
      });

      if (includePanel) {
        panelItems = [
          ...panelItems,
          ...liveResult.activities.filter((row) => row.source === 'admin_panel'),
        ];
      }
      if (includePc) {
        pcItems = [
          ...pcItems,
          ...liveResult.activities.filter((row) => row.source === 'public_circle'),
        ];
      }
    }

    const activities = sortActivities(
      [...panelItems, ...pcItems],
      sort
    );

    if (summaryOnly) {
      return NextResponse.json({
        dateFrom,
        dateTo,
        months,
        warehouseRange: warehouse,
        liveRange: live,
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
      warehouseRange: warehouse,
      liveRange: live,
      activities,
      counts: {
        total: activities.length,
        panel: panelItems.length,
        publicCircle: pcItems.length,
      },
    });
  } catch (err) {
    console.error('[admin-unified-activities/archived]', err);
    return NextResponse.json({ error: 'Failed to load data warehouse activity from S3' }, { status: 500 });
  }
}
