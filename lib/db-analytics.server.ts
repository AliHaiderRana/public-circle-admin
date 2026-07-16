import { ObjectId } from 'mongodb';
import type { Db, Collection } from 'mongodb';

export const COMPANY_GROUP_LIMIT = 5000;
export const COMPANY_FIELD_CANDIDATES = ['company', 'companyId', 'company_id'] as const;
/** Cache collection for on-demand exact per-company size computations */
export const DB_ANALYTICS_STATS_COLLECTION = 'admin-db-analytics-stats';

const COUNT_AGG_TIMEOUT_MS = 20_000;
// Exact sizes scan every document — explicit admin action, so allow a long run
const EXACT_SIZE_TIMEOUT_MS = 120_000;

export function isObjectIdLike(value: unknown): boolean {
  return (
    value instanceof ObjectId ||
    (typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value))
  );
}

export type CompanySizeCacheDoc = {
  _id: string; // collection name
  field: string;
  computedAt: Date;
  durationMs: number;
  truncated: boolean;
  rows: {
    companyId: string | null;
    count: number;
    size: number;
    avgSize: number;
  }[];
};

export async function detectCompanyField(coll: Collection): Promise<string | null> {
  const probe = await coll
    .find({}, { projection: Object.fromEntries(COMPANY_FIELD_CANDIDATES.map((f) => [f, 1])) })
    .limit(25)
    .toArray();

  for (const candidate of COMPANY_FIELD_CANDIDATES) {
    const hits = probe.filter((doc) => {
      const v = doc[candidate];
      return (
        isObjectIdLike(v) ||
        (v && typeof v === 'object' && isObjectIdLike((v as Record<string, unknown>)._id))
      );
    });
    if (hits.length > 0) {
      const firstVal = hits[0][candidate];
      return firstVal && typeof firstVal === 'object' && !(firstVal instanceof ObjectId)
        ? `${candidate}._id`
        : candidate;
    }
  }
  return null;
}

async function resolveCompanyNames(
  db: Db,
  ids: (string | null)[]
): Promise<Map<string, string>> {
  const objectIds = ids
    .filter((id): id is string => id != null && isObjectIdLike(id))
    .map((id) => new ObjectId(id));
  if (objectIds.length === 0) return new Map();
  const companyDocs = await db
    .collection('companies')
    .find({ _id: { $in: objectIds } }, { projection: { name: 1 } })
    .toArray();
  return new Map(companyDocs.map((c) => [String(c._id), String(c.name ?? '')]));
}

function getStatsCache(db: Db) {
  return db.collection<CompanySizeCacheDoc>(DB_ANALYTICS_STATS_COLLECTION);
}

/**
 * Per-company stats: live counts (count-only $group, cheap) merged with the
 * most recent exact-size computation from the cache (if one exists).
 */
export async function getCompanyStats(coll: Collection, db: Db, name: string) {
  const companyField = await detectCompanyField(coll);
  if (!companyField) return null;

  const groups = await coll
    .aggregate(
      [
        { $group: { _id: `$${companyField}`, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: COMPANY_GROUP_LIMIT + 1 },
      ],
      { allowDiskUse: true, maxTimeMS: COUNT_AGG_TIMEOUT_MS }
    )
    .toArray();

  const truncated = groups.length > COMPANY_GROUP_LIMIT;
  const top = groups.slice(0, COMPANY_GROUP_LIMIT);

  const cache = await getStatsCache(db).findOne({ _id: name });
  const cacheValid = cache && cache.field === companyField;
  const sizeByCompany = new Map(
    (cacheValid ? cache.rows : []).map((r) => [r.companyId ?? '__none__', r])
  );

  const nameById = await resolveCompanyNames(
    db,
    top.map((g) => (g._id != null ? String(g._id) : null))
  );

  return {
    field: companyField,
    totalCompanies: top.filter((g) => g._id != null).length,
    truncated,
    sizesComputedAt: cacheValid ? cache.computedAt.toISOString() : null,
    rows: top.map((g) => {
      const companyId = g._id != null ? String(g._id) : null;
      const cached = sizeByCompany.get(companyId ?? '__none__');
      return {
        companyId,
        companyName: companyId ? (nameById.get(companyId) || null) : null,
        count: Number(g.count) || 0,
        size: cached ? cached.size : null,
        avgSize: cached ? cached.avgSize : null,
      };
    }),
  };
}

/**
 * Exact per-company sizes via a full $bsonSize scan (the only way MongoDB can
 * produce them). Explicitly triggered by the admin; result is cached so the
 * page reads it instantly afterwards.
 */
export async function computeExactCompanySizes(coll: Collection, db: Db, name: string) {
  const companyField = await detectCompanyField(coll);
  if (!companyField) return null;

  const started = Date.now();
  const groups = await coll
    .aggregate(
      [
        {
          $group: {
            _id: `$${companyField}`,
            count: { $sum: 1 },
            size: { $sum: { $bsonSize: '$$ROOT' } },
            avgSize: { $avg: { $bsonSize: '$$ROOT' } },
          },
        },
        { $sort: { size: -1 } },
        { $limit: COMPANY_GROUP_LIMIT + 1 },
      ],
      { allowDiskUse: true, maxTimeMS: EXACT_SIZE_TIMEOUT_MS }
    )
    .toArray();

  const truncated = groups.length > COMPANY_GROUP_LIMIT;
  const top = groups.slice(0, COMPANY_GROUP_LIMIT);

  const cacheDoc: CompanySizeCacheDoc = {
    _id: name,
    field: companyField,
    computedAt: new Date(),
    durationMs: Date.now() - started,
    truncated,
    rows: top.map((g) => ({
      companyId: g._id != null ? String(g._id) : null,
      count: Number(g.count) || 0,
      size: Number(g.size) || 0,
      avgSize: Number(g.avgSize) || 0,
    })),
  };

  await getStatsCache(db).replaceOne({ _id: name }, cacheDoc, { upsert: true });
  return cacheDoc;
}
