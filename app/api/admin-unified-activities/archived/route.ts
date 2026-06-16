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

type ArchivePayload = {
  collection?: string;
  period?: string;
  totalRecords?: number;
  archivedAt?: string;
  items?: Record<string, unknown>[];
};

const ARCHIVE_PREFIX = 'admin-activity-archives';

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

export async function GET(request: Request) {
  const { error } = await requireSuperAdminSession();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const month = (searchParams.get('month') || '').trim();
    if (!isValidMonth(month)) {
      return NextResponse.json({ error: 'month must be in YYYY-MM format' }, { status: 400 });
    }

    const source = normalizeSource((searchParams.get('source') || 'all').trim());
    const summaryOnly = searchParams.get('summaryOnly') === '1';
    const adminEmail = (searchParams.get('adminEmail') || '').trim().toLowerCase();
    const category = (searchParams.get('category') || 'all').trim();
    const { panelCategory, pcCategory } = parseCategoryFilter(category, source);

    const includePanel = source !== 'public_circle';
    const includePc = source !== 'admin_panel';

    const panelKey = `${ARCHIVE_PREFIX}/${month}/admin-panel-activities.json`;
    const pcKey = `${ARCHIVE_PREFIX}/${month}/impersonation-activities.json`;

    const [panelPayload, pcPayload] = await Promise.all([
      includePanel ? downloadJsonFromS3<ArchivePayload>({ s3Path: panelKey }) : Promise.resolve(null),
      includePc ? downloadJsonFromS3<ArchivePayload>({ s3Path: pcKey }) : Promise.resolve(null),
    ]);

    const panelItems = (panelPayload?.items || []).filter((item) => {
      const email = String(item.adminEmail ?? '').toLowerCase();
      if (adminEmail && email !== adminEmail) return false;
      if (panelCategory && String(item.category ?? '') !== panelCategory) return false;
      return true;
    });

    const pcItems = (pcPayload?.items || []).filter((item) => {
      const email = String(item.adminEmail ?? '').toLowerCase();
      if (adminEmail && email !== adminEmail) return false;
      const metadata =
        item.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata)
          ? (item.metadata as Record<string, unknown>)
          : null;
      const inferredCategory =
        typeof metadata?.category === 'string'
          ? metadata.category
          : String(item.type ?? '').toLowerCase();
      if (pcCategory && inferredCategory !== pcCategory) return false;
      return true;
    });

    const activities = [
      ...panelItems.map(mapPanelItem),
      ...pcItems.map(mapPcItem),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (summaryOnly) {
      const panelStored = Number(panelPayload?.totalRecords ?? panelPayload?.items?.length ?? 0);
      const pcStored = Number(pcPayload?.totalRecords ?? pcPayload?.items?.length ?? 0);
      return NextResponse.json({
        month,
        summary: {
          totalStored: panelStored + pcStored,
          panelStored,
          publicCircleStored: pcStored,
          panelArchivedAt: panelPayload?.archivedAt || null,
          publicCircleArchivedAt: pcPayload?.archivedAt || null,
        },
        files: {
          panelKey: includePanel ? panelKey : null,
          publicCircleKey: includePc ? pcKey : null,
        },
      });
    }

    return NextResponse.json({
      month,
      activities,
      counts: {
        total: activities.length,
        panel: panelItems.length,
        publicCircle: pcItems.length,
      },
      files: {
        panelKey: includePanel ? panelKey : null,
        publicCircleKey: includePc ? pcKey : null,
      },
    });
  } catch (err) {
    console.error('[admin-unified-activities/archived]', err);
    return NextResponse.json({ error: 'Failed to load archived activity from S3' }, { status: 500 });
  }
}
