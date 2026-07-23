import mongoose from 'mongoose';
import { ObjectId } from 'mongodb';
import type { Db, Collection } from 'mongodb';

// Databases every MongoDB deployment carries internally — never shown as
// "another app's database" in the switcher.
const SYSTEM_DATABASES = new Set(['admin', 'local', 'config']);

export function isSystemDatabase(name: string): boolean {
  return SYSTEM_DATABASES.has(name);
}

export type ClusterDatabaseInfo = {
  name: string;
  sizeOnDisk: number;
  empty: boolean;
};

/**
 * Full Atlas cluster hostname from the connection string, unformatted
 * (e.g. "publiccircles-staging.lx6dtlk.mongodb.net"). MongoDB has no
 * server-side command that returns this — it only exists in the SRV
 * hostname.
 */
export function getClusterName(): string | null {
  const raw = (process.env.MONGODB_URI || process.env.MONGODB_URL || '').trim();
  if (!raw) return null;
  try {
    const host = new URL(raw).hostname;
    return host || null;
  } catch {
    return null;
  }
}

/** Every non-system database on the same cluster this app's connection can see. */
export async function listClusterDatabases(): Promise<ClusterDatabaseInfo[]> {
  const defaultDb = mongoose.connection.db;
  if (!defaultDb) throw new Error('Database connection unavailable');
  const result = await defaultDb.admin().listDatabases();
  return (result.databases ?? [])
    .filter((d) => !SYSTEM_DATABASES.has(d.name))
    .map((d) => ({
      name: d.name,
      sizeOnDisk: Number(d.sizeOnDisk ?? 0),
      empty: Boolean(d.empty),
    }));
}

export type ClusterDatabaseRow = {
  name: string;
  collections: number;
  indexes: number;
  objects: number;
  dataSize: number;
  storageSize: number;
  indexSize: number;
  totalSize: number;
  error?: string;
};

export type ClusterWideStats = {
  databases: number;
  collections: number;
  objects: number;
  dataSize: number;
  storageSize: number;
  indexSize: number;
  totalSize: number;
  failedDatabases: string[];
  perDatabase: ClusterDatabaseRow[];
};

/**
 * Sums dbStats across every non-system database on the cluster, and keeps
 * the per-database breakdown too. One dbStats call per database, run in
 * parallel — cheap relative to per-collection or per-document scans, since
 * it's pure server-side metadata.
 */
export async function getClusterWideStats(
  databases: ClusterDatabaseInfo[]
): Promise<ClusterWideStats> {
  const failedDatabases: string[] = [];

  const perDatabase = await Promise.all(
    databases.map(async (d): Promise<ClusterDatabaseRow> => {
      try {
        const db = resolveDb(d.name);
        const stats = await db.command({ dbStats: 1 });
        const dataSize = Number(stats.dataSize ?? 0);
        const indexSize = Number(stats.indexSize ?? 0);
        return {
          name: d.name,
          collections: Number(stats.collections ?? 0),
          indexes: Number(stats.indexes ?? 0),
          objects: Number(stats.objects ?? 0),
          dataSize,
          storageSize: Number(stats.storageSize ?? 0),
          indexSize,
          totalSize: dataSize + indexSize,
        };
      } catch (err) {
        failedDatabases.push(d.name);
        return {
          name: d.name,
          collections: 0,
          indexes: 0,
          objects: 0,
          dataSize: 0,
          storageSize: 0,
          indexSize: 0,
          totalSize: 0,
          error: err instanceof Error ? err.message : 'Failed to read stats',
        };
      }
    })
  );

  const totals = perDatabase
    .filter((r) => !r.error)
    .reduce(
      (acc, r) => ({
        collections: acc.collections + r.collections,
        objects: acc.objects + r.objects,
        dataSize: acc.dataSize + r.dataSize,
        storageSize: acc.storageSize + r.storageSize,
        indexSize: acc.indexSize + r.indexSize,
      }),
      { collections: 0, objects: 0, dataSize: 0, storageSize: 0, indexSize: 0 }
    );

  return {
    databases: databases.length,
    ...totals,
    // Same "billed usage" definition used everywhere else: data + index, not
    // the compressed on-disk storage size.
    totalSize: totals.dataSize + totals.indexSize,
    failedDatabases,
    perDatabase: perDatabase.sort((a, b) => b.totalSize - a.totalSize),
  };
}

/**
 * Resolves which database a request should read from. Reuses the existing
 * connection pool (no new connection) — just points at a different database
 * on the same cluster. Only ever call with a name that has been validated
 * against listClusterDatabases() to avoid touching system databases.
 */
export function resolveDb(databaseName?: string | null): Db {
  const defaultDb = mongoose.connection.db;
  if (!defaultDb) throw new Error('Database connection unavailable');
  if (!databaseName || databaseName === defaultDb.databaseName) return defaultDb;
  return mongoose.connection.getClient().db(databaseName);
}

export const COMPANY_GROUP_LIMIT = 5000;
export const COMPANY_FIELD_CANDIDATES = [
  'company',
  'companyId',
  'company_id',
  'public_circles_company',
] as const;

// Exact sizes require a full $bsonSize scan (MongoDB keeps no per-company size
// statistics), so give the aggregation a generous budget.
const COMPANY_AGG_TIMEOUT_MS = 120_000;

export function isObjectIdLike(value: unknown): boolean {
  return (
    value instanceof ObjectId ||
    (typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value))
  );
}

export async function detectCompanyField(
  coll: Collection,
  collectionName?: string
): Promise<string | null> {
  // The companies collection doesn't reference a company via a foreign key —
  // each document's own _id IS the company, so group by that directly.
  if (collectionName === 'companies') {
    return '_id';
  }

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

/**
 * Per-company document counts and exact sizes, computed upfront via a full
 * $bsonSize group scan — the only way MongoDB can produce per-company sizes.
 */
export async function getCompanyStats(coll: Collection, db: Db, collectionName?: string) {
  const companyField = await detectCompanyField(coll, collectionName);
  if (!companyField) return null;

  const groups = await coll
    .aggregate(
      [
        {
          $group: {
            _id: `$${companyField}`,
            count: { $sum: 1 },
            size: { $sum: { $bsonSize: '$$ROOT' } },
          },
        },
        { $sort: { size: -1 } },
        { $limit: COMPANY_GROUP_LIMIT + 1 },
      ],
      { allowDiskUse: true, maxTimeMS: COMPANY_AGG_TIMEOUT_MS }
    )
    .toArray();

  const truncated = groups.length > COMPANY_GROUP_LIMIT;
  const top = groups.slice(0, COMPANY_GROUP_LIMIT);

  const nameById = await resolveCompanyNames(
    db,
    top.map((g) => (g._id != null ? String(g._id) : null))
  );

  return {
    field: companyField,
    totalCompanies: top.filter((g) => g._id != null).length,
    truncated,
    rows: top.map((g) => {
      const companyId = g._id != null ? String(g._id) : null;
      return {
        companyId,
        companyName: companyId ? (nameById.get(companyId) || null) : null,
        count: Number(g.count) || 0,
        size: Number(g.size) || 0,
      };
    }),
  };
}
