import mongoose from 'mongoose';
import {
  ADMIN_AUDIT_CATEGORY,
  ADMIN_AUDIT_CATEGORY_LABELS,
} from '@/lib/admin-audit.constants';
import {
  buildAuditDateFilter,
  escapeRegexEmail,
  type AuditSortOrder,
} from '@/lib/audit-query';
import {
  formatImpersonationDisplaySummary,
  IMPERSONATION_ACTIVITY_CATEGORY_LABELS,
  isNoiseImpersonationRow,
} from '@/lib/impersonation-activity-labels';
import type {
  GroupedTimelineEntry,
  UnifiedActivityRow,
} from '@/lib/unified-admin-activity';

function parseCategoryFilter(
  raw: string,
  source: string
): { panelCategory?: string; pcCategory?: string } {
  const category = raw.trim();
  if (!category || category === 'all') return {};

  if (category.startsWith('panel:')) {
    return { panelCategory: category.slice('panel:'.length) };
  }
  if (category.startsWith('pc:')) {
    return { pcCategory: category.slice('pc:'.length) };
  }

  if (source === 'admin_panel') {
    return { panelCategory: category };
  }
  if (source === 'public_circle') {
    return { pcCategory: category };
  }

  const panelValues = new Set<string>(Object.values(ADMIN_AUDIT_CATEGORY));
  const pcValues = new Set(Object.keys(IMPERSONATION_ACTIVITY_CATEGORY_LABELS));
  if (panelValues.has(category)) return { panelCategory: category };
  if (pcValues.has(category)) return { pcCategory: category };
  return {};
}

function buildPanelMatch(params: {
  adminEmail: string;
  dateFrom: string;
  dateTo: string;
  panelCategory?: string;
}): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  if (params.adminEmail) {
    filter.adminEmail = { $regex: escapeRegexEmail(params.adminEmail), $options: 'i' };
  }
  if (params.panelCategory) {
    filter.category = params.panelCategory;
  }
  const createdAtRange = buildAuditDateFilter(params.dateFrom, params.dateTo);
  if (createdAtRange) filter.createdAt = createdAtRange;
  return filter;
}

function buildPcMatch(params: {
  adminEmail: string;
  userEmail: string;
  userId: string;
  companyId: string;
  dateFrom: string;
  dateTo: string;
  pcCategory?: string;
  hideNoise: boolean;
}): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  if (params.adminEmail) {
    filter.adminEmail = { $regex: escapeRegexEmail(params.adminEmail), $options: 'i' };
  }
  if (params.userEmail) {
    filter.impersonatedUserEmail = {
      $regex: escapeRegexEmail(params.userEmail),
      $options: 'i',
    };
  }
  if (params.userId && mongoose.Types.ObjectId.isValid(params.userId)) {
    filter.impersonatedUserId = new mongoose.Types.ObjectId(params.userId);
  }
  if (params.companyId && mongoose.Types.ObjectId.isValid(params.companyId)) {
    filter.companyId = new mongoose.Types.ObjectId(params.companyId);
  }
  if (params.pcCategory) {
    filter['metadata.category'] = params.pcCategory;
  }
  const createdAtRange = buildAuditDateFilter(params.dateFrom, params.dateTo);
  if (createdAtRange) filter.createdAt = createdAtRange;
  if (params.hideNoise) {
    filter.$nor = [
      { path: { $regex: /^WEBSOCKET_/i } },
      {
        path: {
          $regex:
            /get-dashboard-data|get-paginated-contacts|get-segment-count|get-filter-count|\/segments\/all|\/filters\/all|\/filters\/get-data-type|duplicates\/recompute/i,
        },
      },
      { summary: { $regex: /recomputed duplicate contacts/i } },
      { summary: { $regex: /WEBSOCKET|get-paginated-contacts|get-dashboard-data/i } },
    ];
  }
  return filter;
}

function mapPanelRow(row: Record<string, unknown>): UnifiedActivityRow {
  const category = String(row.category ?? '');
  return {
    id: `panel:${String(row._id)}`,
    source: 'admin_panel',
    adminEmail: String(row.adminEmail ?? ''),
    adminName: String(row.adminName ?? ''),
    summary: String(row.summary ?? ''),
    category,
    categoryLabel: ADMIN_AUDIT_CATEGORY_LABELS[category] ?? category,
    createdAt: new Date(row.createdAt as string | Date).toISOString(),
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

function mapPcRow(row: Record<string, unknown>): UnifiedActivityRow | null {
  const path = row.path != null ? String(row.path) : null;
  const type = String(row.type ?? '');
  const summaryRaw = row.summary != null ? String(row.summary) : null;
  const metadata =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : null;
  const requestBody =
    row.requestBody &&
    typeof row.requestBody === 'object' &&
    !Array.isArray(row.requestBody)
      ? (row.requestBody as Record<string, unknown>)
      : null;
  const query =
    row.query && typeof row.query === 'object' && !Array.isArray(row.query)
      ? (row.query as Record<string, unknown>)
      : null;

  if (
    isNoiseImpersonationRow({
      path,
      type,
      summary: summaryRaw,
    })
  ) {
    return null;
  }

  const summary =
    formatImpersonationDisplaySummary({
      summary: summaryRaw,
      path,
      type,
      method: row.method != null ? String(row.method) : null,
      metadata,
      requestBody,
    }) || summaryRaw || type;

  const category =
    typeof metadata?.category === 'string' ? metadata.category : type.toLowerCase();

  return {
    id: `pc:${String(row._id)}`,
    source: 'public_circle',
    adminEmail: String(row.adminEmail ?? ''),
    adminName: String(row.adminName ?? ''),
    summary,
    category,
    categoryLabel:
      IMPERSONATION_ACTIVITY_CATEGORY_LABELS[category] ??
      (type === 'SESSION_START' || type === 'SESSION_END' ? 'Session' : category),
    createdAt: new Date(row.createdAt as string | Date).toISOString(),
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

function sortMerged(rows: UnifiedActivityRow[], sort: AuditSortOrder): UnifiedActivityRow[] {
  return [...rows].sort((a, b) => {
    const at = new Date(a.createdAt).getTime();
    const bt = new Date(b.createdAt).getTime();
    return sort === 'asc' ? at - bt : bt - at;
  });
}

export async function fetchUnifiedAdminActivities({
  AdminActivity,
  AdminImpersonationActivity,
  page,
  limit,
  sort,
  source,
  adminEmail,
  userEmail,
  userId,
  companyId,
  dateFrom,
  dateTo,
  category,
  hideNoise,
}: {
  AdminActivity: mongoose.Model<unknown>;
  AdminImpersonationActivity: mongoose.Model<unknown>;
  page: number;
  limit: number;
  sort: AuditSortOrder;
  source: string;
  adminEmail: string;
  userEmail: string;
  userId: string;
  companyId: string;
  dateFrom: string;
  dateTo: string;
  category: string;
  hideNoise: boolean;
}) {
  const { panelCategory, pcCategory } = parseCategoryFilter(category, source);
  const includePanel = source !== 'public_circle';
  const includePc = source !== 'admin_panel';
  const sortDir = sort === 'asc' ? 1 : -1;
  const skip = (page - 1) * limit;
  const fetchSize = skip + limit;

  const panelMatch = buildPanelMatch({ adminEmail, dateFrom, dateTo, panelCategory });
  const pcMatch = buildPcMatch({
    adminEmail,
    userEmail,
    userId,
    companyId,
    dateFrom,
    dateTo,
    pcCategory,
    hideNoise,
  });

  const [panelTotal, pcTotal] = await Promise.all([
    includePanel ? AdminActivity.countDocuments(panelMatch) : Promise.resolve(0),
    includePc ? AdminImpersonationActivity.countDocuments(pcMatch) : Promise.resolve(0),
  ]);

  const [panelRows, pcRows] = await Promise.all([
    includePanel
      ? AdminActivity.find(panelMatch)
          .sort({ createdAt: sortDir })
          .limit(fetchSize)
          .lean()
      : Promise.resolve([]),
    includePc
      ? AdminImpersonationActivity.find(pcMatch)
          .sort({ createdAt: sortDir })
          .limit(fetchSize)
          .lean()
      : Promise.resolve([]),
  ]);

  const merged = sortMerged(
    [
      ...(panelRows as Record<string, unknown>[]).map(mapPanelRow),
      ...(pcRows as Record<string, unknown>[])
        .map(mapPcRow)
        .filter((row): row is UnifiedActivityRow => row != null),
    ],
    sort
  );

  const activities = merged.slice(skip, skip + limit);
  const total = panelTotal + pcTotal;

  return {
    activities,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      panelTotal,
      publicCircleTotal: pcTotal,
    },
  };
}

export type ImpersonatedCustomerSummary = {
  email: string;
  name?: string;
  companyName?: string;
  activityCount: number;
  lastActivityAt: string;
};

export async function fetchImpersonatedCustomersForAdmin({
  AdminActivity,
  AdminImpersonationActivity,
  adminEmail,
  dateFrom,
  dateTo,
  hideNoise,
  limit = 30,
}: {
  AdminActivity: mongoose.Model<unknown>;
  AdminImpersonationActivity: mongoose.Model<unknown>;
  adminEmail: string;
  dateFrom: string;
  dateTo: string;
  hideNoise: boolean;
  limit?: number;
}) {
  const pcMatch = buildPcMatch({
    adminEmail,
    userEmail: '',
    userId: '',
    companyId: '',
    dateFrom,
    dateTo,
    hideNoise,
  });

  const rows = await AdminImpersonationActivity.aggregate([
    { $match: pcMatch },
    {
      $group: {
        _id: '$impersonatedUserEmail',
        activityCount: { $sum: 1 },
        lastActivityAt: { $max: '$createdAt' },
      },
    },
    { $match: { _id: { $nin: [null, ''] } } },
    { $sort: { lastActivityAt: -1 } },
    { $limit: limit },
  ]);

  const panelLoginMatch = {
    ...buildPanelMatch({ adminEmail, dateFrom, dateTo, panelCategory: undefined }),
    category: ADMIN_AUDIT_CATEGORY.IMPERSONATION,
  };
  const panelLogins = (await AdminActivity.find(panelLoginMatch).lean()) as Record<
    string,
    unknown
  >[];

  const profileByEmail = new Map<string, { name?: string; companyName?: string }>();
  for (const login of panelLogins) {
    const details =
      login.details && typeof login.details === 'object' && !Array.isArray(login.details)
        ? (login.details as Record<string, unknown>)
        : null;
    const email =
      typeof details?.impersonatedUserEmail === 'string'
        ? details.impersonatedUserEmail.trim().toLowerCase()
        : '';
    if (!email) continue;
    profileByEmail.set(email, {
      name:
        typeof details?.impersonatedUserName === 'string'
          ? details.impersonatedUserName.trim()
          : undefined,
      companyName:
        typeof details?.companyName === 'string' ? details.companyName.trim() : undefined,
    });
  }

  return rows.map((row) => {
    const email = String(row._id);
    const profile = profileByEmail.get(email.trim().toLowerCase());
    return {
      email,
      name: profile?.name,
      companyName: profile?.companyName,
      activityCount: Number(row.activityCount ?? 0),
      lastActivityAt: new Date(row.lastActivityAt as Date).toISOString(),
    };
  }) satisfies ImpersonatedCustomerSummary[];
}

function sortTimelineEntries(
  entries: GroupedTimelineEntry[],
  sort: AuditSortOrder
): GroupedTimelineEntry[] {
  return [...entries].sort((a, b) => {
    const at = new Date(a.createdAt).getTime();
    const bt = new Date(b.createdAt).getTime();
    return sort === 'asc' ? at - bt : bt - at;
  });
}

export async function fetchGroupedAdminTimeline({
  AdminActivity,
  AdminImpersonationActivity,
  page,
  limit,
  sort,
  source,
  adminEmail,
  userEmail,
  userId,
  companyId,
  dateFrom,
  dateTo,
  category,
  hideNoise,
}: {
  AdminActivity: mongoose.Model<unknown>;
  AdminImpersonationActivity: mongoose.Model<unknown>;
  page: number;
  limit: number;
  sort: AuditSortOrder;
  source: string;
  adminEmail: string;
  userEmail: string;
  userId: string;
  companyId: string;
  dateFrom: string;
  dateTo: string;
  category: string;
  hideNoise: boolean;
}) {
  const effectiveSource = source === 'admin_panel' || source === 'public_circle' ? source : 'all';
  const { panelCategory, pcCategory } = parseCategoryFilter(category, effectiveSource);
  const skip = (page - 1) * limit;
  const sortDir = sort === 'asc' ? 1 : -1;

  const panelBaseMatch = buildPanelMatch({
    adminEmail,
    dateFrom,
    dateTo,
    panelCategory: undefined,
  });
  const pcMatch = buildPcMatch({
    adminEmail,
    userEmail,
    userId,
    companyId,
    dateFrom,
    dateTo,
    pcCategory,
    hideNoise,
  });

  const sourceIsAll = effectiveSource === 'all';
  const sourceIsPanel = effectiveSource === 'admin_panel';
  const sourceIsPc = effectiveSource === 'public_circle';

  let includePanelActivities =
    !sourceIsPc &&
    !pcCategory &&
    (!panelCategory || panelCategory !== ADMIN_AUDIT_CATEGORY.IMPERSONATION);
  let includeSessions =
    !sourceIsPanel &&
    (!panelCategory ||
      panelCategory === ADMIN_AUDIT_CATEGORY.IMPERSONATION ||
      Boolean(pcCategory));

  if (sourceIsPanel) {
    includePanelActivities = true;
    includeSessions = false;
  } else if (sourceIsPc) {
    includePanelActivities = false;
    includeSessions = true;
  }

  const sessionAgg = includeSessions
    ? await AdminImpersonationActivity.aggregate([
        { $match: pcMatch },
        {
          $group: {
            _id: '$sessionId',
            customerEmail: { $first: '$impersonatedUserEmail' },
            sessionStartAt: { $min: '$createdAt' },
            actionCount: {
              $sum: {
                $cond: [{ $ne: ['$type', 'SESSION_START'] }, 1, 0],
              },
            },
          },
        },
        { $match: { _id: { $nin: [null, ''] } } },
      ])
    : [];

  const sessionAggById = new Map(
    sessionAgg.map((row) => [
      String(row._id),
      {
        customerEmail: String(row.customerEmail ?? ''),
        sessionStartAt: row.sessionStartAt as Date,
        actionCount: Number(row.actionCount ?? 0),
      },
    ])
  );

  const panelLoginMatch = {
    ...panelBaseMatch,
    category: ADMIN_AUDIT_CATEGORY.IMPERSONATION,
  };
  const panelLogins = includeSessions
    ? ((await AdminActivity.find(panelLoginMatch).sort({ createdAt: sortDir }).lean()) as Record<
        string,
        unknown
      >[])
    : [];

  const sessionsMap = new Map<string, GroupedTimelineEntry & { kind: 'session' }>();

  for (const login of panelLogins) {
    const details =
      login.details && typeof login.details === 'object' && !Array.isArray(login.details)
        ? (login.details as Record<string, unknown>)
        : null;
    const sessionId = details?.sessionId != null ? String(details.sessionId) : '';
    if (!sessionId) continue;

    const agg = sessionAggById.get(sessionId);
    if (pcCategory && !agg) continue;

    const mapped = mapPanelRow(login);
    sessionsMap.set(sessionId, {
      kind: 'session',
      id: `session:${sessionId}`,
      sessionId,
      createdAt: mapped.createdAt,
      loginSummary: mapped.summary,
      customerEmail:
        typeof details?.impersonatedUserEmail === 'string'
          ? details.impersonatedUserEmail
          : agg?.customerEmail ?? '',
      customerName:
        typeof details?.impersonatedUserName === 'string'
          ? details.impersonatedUserName
          : undefined,
      companyName: typeof details?.companyName === 'string' ? details.companyName : undefined,
      actionCount: agg?.actionCount ?? 0,
    });
  }

  if (includeSessions) {
    for (const [sessionId, agg] of sessionAggById) {
      if (sessionsMap.has(sessionId)) continue;

      const startRow = (await AdminImpersonationActivity.findOne({
        sessionId,
        type: 'SESSION_START',
      }).lean()) as Record<string, unknown> | null;

      const mappedStart = startRow ? mapPcRow(startRow) : null;
      sessionsMap.set(sessionId, {
        kind: 'session',
        id: `session:${sessionId}`,
        sessionId,
        createdAt: mappedStart
          ? mappedStart.createdAt
          : new Date(agg.sessionStartAt).toISOString(),
        loginSummary:
          mappedStart?.summary ?? `Started Login as user (${agg.customerEmail})`,
        customerEmail: agg.customerEmail,
        actionCount: agg.actionCount,
      });
    }
  }

  const entries: GroupedTimelineEntry[] = [];

  if (includePanelActivities) {
    const activityMatch: Record<string, unknown> = { ...panelBaseMatch };
    if (panelCategory) {
      activityMatch.category = panelCategory;
    } else {
      activityMatch.category = { $ne: ADMIN_AUDIT_CATEGORY.IMPERSONATION };
    }

    const panelActivities = (await AdminActivity.find(activityMatch)
      .sort({ createdAt: sortDir })
      .lean()) as Record<string, unknown>[];

    for (const row of panelActivities) {
      const mapped = mapPanelRow(row);
      entries.push({
        kind: 'activity',
        id: mapped.id,
        createdAt: mapped.createdAt,
        row: mapped,
      });
    }
  }

  if (includeSessions) {
    for (const sessionEntry of sessionsMap.values()) {
      if (pcCategory && sessionEntry.actionCount === 0) continue;
      entries.push(sessionEntry);
    }
  }

  const sorted = sortTimelineEntries(entries, sort);
  const total = sorted.length;
  const timeline = sorted.slice(skip, skip + limit);

  const panelActivityTotal = includePanelActivities
    ? await AdminActivity.countDocuments({
        ...panelBaseMatch,
        ...(panelCategory
          ? { category: panelCategory }
          : { category: { $ne: ADMIN_AUDIT_CATEGORY.IMPERSONATION } }),
      })
    : 0;

  const sessionTotal = includeSessions
    ? Array.from(sessionsMap.values()).filter((s) => !pcCategory || s.actionCount > 0).length
    : 0;

  const pcActionTotal = includeSessions
    ? sessionAgg.reduce((sum, row) => sum + Number(row.actionCount ?? 0), 0)
    : 0;

  return {
    timeline,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      panelTotal: panelActivityTotal,
      sessionTotal,
      publicCircleTotal: pcActionTotal,
    },
  };
}

export async function fetchSessionActivities({
  AdminImpersonationActivity,
  sessionId,
  adminEmail,
  userEmail,
  dateFrom,
  dateTo,
  pcCategory,
  hideNoise,
  sort,
}: {
  AdminImpersonationActivity: mongoose.Model<unknown>;
  sessionId: string;
  adminEmail: string;
  userEmail: string;
  dateFrom: string;
  dateTo: string;
  pcCategory?: string;
  hideNoise: boolean;
  sort: AuditSortOrder;
}) {
  const sortDir = sort === 'asc' ? 1 : -1;
  const match = buildPcMatch({
    adminEmail,
    userEmail,
    userId: '',
    companyId: '',
    dateFrom,
    dateTo,
    pcCategory,
    hideNoise,
  });
  match.sessionId = sessionId;

  const rows = (await AdminImpersonationActivity.find(match)
    .sort({ createdAt: sortDir })
    .lean()) as Record<string, unknown>[];

  return rows
    .map(mapPcRow)
    .filter((row): row is UnifiedActivityRow => row != null && row.activityType !== 'SESSION_START');
}
