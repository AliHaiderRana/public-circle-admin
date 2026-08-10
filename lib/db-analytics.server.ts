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
    // Atlas defines cluster "Data Size" as dataSize + indexSize (see
    // https://www.mongodb.com/docs/atlas/reference/faq/storage/) — not
    // dbStats.totalSize, which is storageSize + indexSize instead. Note
    // Atlas's own UI labels this figure "GB" but renders it in GiB (1024-based),
    // so its displayed number will still read ~7% lower than this decimal-GB
    // value — that gap is Atlas's unit mislabeling, not a data discrepancy.
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

export type CompanyFootprintCollectionRow = {
  collectionName: string;
  field: string;
  count: number;
  size: number;
};

export type CompanyDbFootprint = {
  collections: CompanyFootprintCollectionRow[];
  totalDocuments: number;
  totalSize: number;
};

/**
 * Admin-panel infrastructure collections excluded from company deletion —
 * audit trails, cron/config bookkeeping — even when they happen to reference
 * a company (e.g. an impersonation log entry). Everything else that this
 * company's id shows up in is treated as that company's own business data.
 */
const COMPANY_DELETION_EXCLUDED_COLLECTIONS = new Set([
  'app-configs',
  'adminusers',
  'admin-activities',
  'admin-impersonation-activities',
  'admin-notifications',
  'cron-histories',
  'cron-metadata',
  'changelogs',
]);

// Count/size aggregates are purely informational for the preview — cap them
// so one huge or unindexed collection can't stall the whole scan.
const FOOTPRINT_COUNT_TIMEOUT_MS = 5000;

/**
 * Structurally detects, in parallel, which collections reference this
 * company at all (cheap: samples 25 docs per collection, no company-specific
 * filter). This is the list actual deletion acts on — kept independent of
 * the best-effort count/size aggregate below so a slow count can never cause
 * a collection to be silently skipped at delete time.
 */
export async function detectCompanyReferencingCollections(): Promise<{ name: string; field: string }[]> {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database connection unavailable');

  const collectionInfos = await db.listCollections().toArray();
  const candidates = collectionInfos
    .map((info) => info.name)
    .filter((name) => name !== 'companies' && !COMPANY_DELETION_EXCLUDED_COLLECTIONS.has(name));

  const detected = await Promise.all(
    candidates.map(async (name) => {
      const field = await detectCompanyField(db.collection(name), name);
      return field ? { name, field } : null;
    })
  );

  return detected.filter((r): r is { name: string; field: string } => r !== null);
}

/** Scans every collection in the app database for documents referencing this company. */
export async function getCompanyDbFootprint(companyId: string): Promise<CompanyDbFootprint> {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database connection unavailable');
  const objectId = new ObjectId(companyId);

  const referencing = await detectCompanyReferencingCollections();

  const rows = await Promise.all(
    referencing.map(async ({ name, field }): Promise<CompanyFootprintCollectionRow> => {
      try {
        const [agg] = await db
          .collection(name)
          .aggregate(
            [
              { $match: { [field]: objectId } },
              { $group: { _id: null, count: { $sum: 1 }, size: { $sum: { $bsonSize: '$$ROOT' } } } },
            ],
            { maxTimeMS: FOOTPRINT_COUNT_TIMEOUT_MS }
          )
          .toArray();
        return {
          collectionName: name,
          field,
          count: agg ? Number(agg.count) || 0 : 0,
          size: agg ? Number(agg.size) || 0 : 0,
        };
      } catch {
        // Count timed out or failed — still surface the collection (with an
        // unknown count) rather than silently dropping it from the preview.
        return { collectionName: name, field, count: -1, size: -1 };
      }
    })
  );

  const withMatches = rows.filter((r) => r.count !== 0);
  withMatches.sort((a, b) => b.size - a.size);

  return {
    collections: withMatches,
    totalDocuments: withMatches.reduce((s, r) => s + Math.max(r.count, 0), 0),
    totalSize: withMatches.reduce((s, r) => s + Math.max(r.size, 0), 0),
  };
}

/**
 * Deletes every document in every collection structurally detected as
 * referencing this company, then the company document itself last. Re-runs
 * detection fresh rather than trusting a previously computed preview, so
 * completeness never depends on the preview's (best-effort, capped) counts.
 * Pass a transaction session when the deployment supports it (see
 * runWithOptionalTransaction) so a failure partway through doesn't leave the
 * company half-deleted.
 */
export async function deleteCompanyDbFootprint(
  companyId: string,
  session?: import('mongoose').ClientSession,
  onProgress?: (collectionName: string, index: number, total: number) => void
): Promise<{ deletedDocuments: number; deletedCollections: string[] }> {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database connection unavailable');
  const objectId = new ObjectId(companyId);
  const options = session ? { session } : undefined;

  const referencing = await detectCompanyReferencingCollections();
  const total = referencing.length + 1; // + the companies collection itself

  let deletedDocuments = 0;
  const deletedCollections: string[] = [];

  for (let i = 0; i < referencing.length; i++) {
    const { name, field } = referencing[i];
    onProgress?.(name, i, total);
    const result = await db.collection(name).deleteMany({ [field]: objectId }, options);
    deletedDocuments += result.deletedCount ?? 0;
    if (result.deletedCount) deletedCollections.push(name);
  }

  onProgress?.('companies', referencing.length, total);
  const companyResult = await db
    .collection('companies')
    .deleteOne({ _id: objectId }, options);
  if (companyResult.deletedCount) {
    deletedDocuments += companyResult.deletedCount;
    deletedCollections.push('companies');
  }

  return { deletedDocuments, deletedCollections };
}
