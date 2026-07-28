import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListBucketsCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ObjectId } from 'mongodb';
import type { Db } from 'mongodb';

const OID_RE = /^[a-f0-9]{24}$/i;
// Safety cap per bucket: 500 pages × 1000 keys = 500k objects
const MAX_PAGES_PER_BUCKET = 500;
// Safety cap when browsing into a single folder: 200 pages × 1000 keys = 200k objects
const MAX_PAGES_PER_BROWSE = 200;
const CACHE_TTL_MS = 10 * 60 * 1000;
const BROWSE_CACHE_TTL_MS = 2 * 60 * 1000;
const FILE_URL_EXPIRY_SECONDS = 5 * 60;

export type BucketFolderUsage = {
  folder: string;
  objects: number;
  bytes: number;
};

export type BrowseFile = {
  name: string;
  key: string;
  bytes: number;
  lastModified: string | null;
};

export type BucketStats = {
  name: string;
  objects: number;
  bytes: number;
  truncated: boolean;
  folders: BucketFolderUsage[];
  /** Files that sit directly in the bucket root (no folder prefix) */
  rootFiles: BrowseFile[];
};

export type CompanyBucketUsage = {
  bucket: string;
  objects: number;
  bytes: number;
};

export type CompanyUsageRow = {
  companyId: string;
  companyName: string | null;
  objects: number;
  bytes: number;
  buckets: CompanyBucketUsage[];
  /** True when this id only resolved via the archived-companies record (the live company document is gone). */
  archived: boolean;
};

export type AwsAnalytics = {
  region: string;
  buckets: BucketStats[];
  totals: {
    buckets: number;
    objects: number;
    bytes: number;
  };
  companies: CompanyUsageRow[];
  unattributed: { objects: number; bytes: number };
  generatedAt: string;
};

let cache: { data: AwsAnalytics; cachedAt: number } | null = null;
let refreshInFlight: Promise<AwsAnalytics> | null = null;

/**
 * Optional environment-scoped bucket allowlist. Each deployment (staging vs
 * production, per app) sets this to just the bucket names relevant to it —
 * e.g. the staging admin deployment lists only staging buckets, so this
 * screen never shows another environment's data. Unset = show every bucket
 * in the AWS account (local dev default).
 */
function getAllowedBucketNames(): Set<string> | null {
  const raw = (process.env.AWS_ANALYTICS_BUCKETS || '').trim();
  if (!raw) return null;
  const names = raw
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);
  return names.length ? new Set(names) : null;
}

export function createClient(): { client: S3Client; region: string } | null {
  const region = (process.env.AWS_REGION || 'ca-central-1').trim();
  const accessKeyId = (process.env.AWS_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (process.env.AWS_SECRET_ACCESS_KEY || '').trim();
  if (!accessKeyId || !secretAccessKey) return null;
  return {
    client: new S3Client({ region, credentials: { accessKeyId, secretAccessKey } }),
    region,
  };
}

/** First ObjectId-looking path segment — candidate owner id for the object. */
function extractCandidateId(key: string): string | null {
  for (const part of key.split('/')) {
    if (OID_RE.test(part)) return part.toLowerCase();
  }
  return null;
}

/** Top-level "folder" (first path segment) an object lives under, or null if
 * the object sits directly in the bucket root. S3 has no real folders, but
 * keys are conventionally namespaced this way. */
function extractTopFolder(key: string): string | null {
  const slash = key.indexOf('/');
  return slash === -1 ? null : key.slice(0, slash);
}

type CandidateAgg = {
  objects: number;
  bytes: number;
  buckets: Map<string, { objects: number; bytes: number }>;
};

/** Returns null for buckets that can't be listed (other region / no permission). */
async function scanBucket(
  client: S3Client,
  name: string,
  byCandidate: Map<string, CandidateAgg>,
  noCandidate: { objects: number; bytes: number }
): Promise<BucketStats | null> {
  const stats: BucketStats = {
    name,
    objects: 0,
    bytes: 0,
    truncated: false,
    folders: [],
    rootFiles: [],
  };
  const folderAgg = new Map<string, { objects: number; bytes: number }>();

  try {
    let token: string | undefined;
    let pages = 0;
    do {
      const res = await client.send(
        new ListObjectsV2Command({ Bucket: name, ContinuationToken: token, MaxKeys: 1000 })
      );
      pages += 1;
      for (const obj of res.Contents ?? []) {
        const size = obj.Size ?? 0;
        stats.objects += 1;
        stats.bytes += size;

        if (obj.Key) {
          const folder = extractTopFolder(obj.Key);
          if (folder === null) {
            stats.rootFiles.push({
              name: obj.Key,
              key: obj.Key,
              bytes: size,
              lastModified: obj.LastModified ? obj.LastModified.toISOString() : null,
            });
          } else {
            const fAgg = folderAgg.get(folder) ?? { objects: 0, bytes: 0 };
            fAgg.objects += 1;
            fAgg.bytes += size;
            folderAgg.set(folder, fAgg);
          }
        }

        const candidate = obj.Key ? extractCandidateId(obj.Key) : null;
        if (candidate) {
          let agg = byCandidate.get(candidate);
          if (!agg) {
            agg = { objects: 0, bytes: 0, buckets: new Map() };
            byCandidate.set(candidate, agg);
          }
          agg.objects += 1;
          agg.bytes += size;
          const bucketAgg = agg.buckets.get(name) ?? { objects: 0, bytes: 0 };
          bucketAgg.objects += 1;
          bucketAgg.bytes += size;
          agg.buckets.set(name, bucketAgg);
        } else {
          noCandidate.objects += 1;
          noCandidate.bytes += size;
        }
      }
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
      if (pages >= MAX_PAGES_PER_BUCKET && token) {
        stats.truncated = true;
        break;
      }
    } while (token);
  } catch {
    return null;
  }

  stats.folders = [...folderAgg.entries()]
    .map(([folder, usage]) => ({ folder, ...usage }))
    .sort((a, b) => b.bytes - a.bytes);
  stats.rootFiles.sort((a, b) => a.name.localeCompare(b.name));

  return stats;
}

export type BrowseFolder = {
  name: string;
  prefix: string;
  objects: number;
  bytes: number;
};

export type BrowseResult = {
  bucket: string;
  prefix: string;
  folders: BrowseFolder[];
  files: BrowseFile[];
  truncated: boolean;
};

const browseCache = new Map<string, { data: BrowseResult; cachedAt: number }>();

function browseCacheKey(bucket: string, prefix: string, companyId?: string): string {
  return `${bucket}::${prefix}::${companyId ?? ''}`;
}

/** Whether a key has `companyId` as one of its path segments. */
function keyBelongsToCompany(key: string, companyId: string): boolean {
  const target = companyId.toLowerCase();
  return key.split('/').some((part) => part.toLowerCase() === target);
}

/**
 * Lists the immediate contents (subfolders + files) of a bucket "directory".
 * S3 has no real folders, so this lists every key under `prefix` and groups
 * by the next path segment — bounded to that subtree, not the whole bucket.
 * When `companyId` is given, only that company's objects are included (used
 * for the "browse this company's files" flow) — everything else is skipped.
 * Short-lived cache makes back/forward navigation feel instant.
 */
export async function browseBucketPrefix(
  bucketName: string,
  prefix: string,
  companyId?: string
): Promise<BrowseResult> {
  const normalizedPrefix = prefix ? (prefix.endsWith('/') ? prefix : `${prefix}/`) : '';
  const cacheKey = browseCacheKey(bucketName, normalizedPrefix, companyId);
  const cached = browseCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < BROWSE_CACHE_TTL_MS) {
    return cached.data;
  }

  const setup = createClient();
  if (!setup) {
    throw new Error('AWS credentials are not configured');
  }
  const { client } = setup;

  const folderAgg = new Map<string, { objects: number; bytes: number }>();
  const files: BrowseFile[] = [];
  let truncated = false;

  let token: string | undefined;
  let pages = 0;
  do {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: normalizedPrefix,
        ContinuationToken: token,
        MaxKeys: 1000,
      })
    );
    pages += 1;
    for (const obj of res.Contents ?? []) {
      if (!obj.Key || obj.Key === normalizedPrefix) continue;
      if (companyId && !keyBelongsToCompany(obj.Key, companyId)) continue;
      const size = obj.Size ?? 0;
      const rest = obj.Key.slice(normalizedPrefix.length);
      const slash = rest.indexOf('/');
      if (slash === -1) {
        files.push({
          name: rest,
          key: obj.Key,
          bytes: size,
          lastModified: obj.LastModified ? obj.LastModified.toISOString() : null,
        });
      } else {
        const folder = rest.slice(0, slash);
        const agg = folderAgg.get(folder) ?? { objects: 0, bytes: 0 };
        agg.objects += 1;
        agg.bytes += size;
        folderAgg.set(folder, agg);
      }
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
    if (pages >= MAX_PAGES_PER_BROWSE && token) {
      truncated = true;
      break;
    }
  } while (token);

  const result: BrowseResult = {
    bucket: bucketName,
    prefix: normalizedPrefix,
    folders: [...folderAgg.entries()]
      .map(([folder, usage]) => ({
        name: folder,
        prefix: `${normalizedPrefix}${folder}/`,
        ...usage,
      }))
      .sort((a, b) => b.bytes - a.bytes),
    files: files.sort((a, b) => a.name.localeCompare(b.name)),
    truncated,
  };

  if (browseCache.size >= 200) {
    browseCache.delete(browseCache.keys().next().value!);
  }
  browseCache.set(cacheKey, { data: result, cachedAt: Date.now() });

  return result;
}

/**
 * Presigned, time-limited URL so an admin can view or download a single file.
 * When `download` is true, sets Content-Disposition so the browser saves the
 * file instead of trying to render it inline.
 */
export async function getPresignedFileUrl(
  bucketName: string,
  key: string,
  download = false
): Promise<string> {
  const setup = createClient();
  if (!setup) {
    throw new Error('AWS credentials are not configured');
  }
  const fileName = key.slice(key.lastIndexOf('/') + 1) || 'download';
  return getSignedUrl(
    setup.client,
    new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
      ...(download
        ? { ResponseContentDisposition: `attachment; filename="${fileName.replace(/"/g, '')}"` }
        : {}),
    }),
    { expiresIn: FILE_URL_EXPIRY_SECONDS }
  );
}

async function computeAwsAnalytics(db: Db): Promise<AwsAnalytics> {
  const setup = createClient();
  if (!setup) {
    throw new Error('AWS credentials are not configured');
  }
  const { client, region } = setup;

  const listRes = await client.send(new ListBucketsCommand({}));
  const allowedBuckets = getAllowedBucketNames();
  const bucketNames = (listRes.Buckets ?? [])
    .map((b) => b.Name)
    .filter((n): n is string => Boolean(n))
    .filter((n) => !allowedBuckets || allowedBuckets.has(n));

  const byCandidate = new Map<string, CandidateAgg>();
  const noCandidate = { objects: 0, bytes: 0 };

  // All buckets scanned in parallel; inaccessible ones resolve to null and
  // are silently dropped from the result.
  const scans = await Promise.all(
    bucketNames.map((name) => scanBucket(client, name, byCandidate, noCandidate))
  );
  const buckets = scans
    .filter((b): b is BucketStats => b !== null)
    .sort((a, b) => b.bytes - a.bytes);

  // Ids that exist in the companies collection count as company usage; ids
  // that no longer have a live company (archived) still resolve via the
  // archived-companies record, so backed-up files stay attributed by name
  // instead of falling into "unattributed". Everything else (users,
  // templates, etc.) falls into "unattributed".
  const candidateIds = [...byCandidate.keys()];
  const companyDocs = candidateIds.length
    ? await db
        .collection('companies')
        .find(
          { _id: { $in: candidateIds.map((id) => new ObjectId(id)) } },
          { projection: { name: 1 } }
        )
        .toArray()
    : [];
  const nameById = new Map(companyDocs.map((c) => [String(c._id), String(c.name ?? '')]));

  const unresolvedIds = candidateIds.filter((id) => !nameById.has(id));
  const archivedDocs = unresolvedIds.length
    ? await db
        .collection('archived-companies')
        .find({ companyId: { $in: unresolvedIds } }, { projection: { companyId: 1, companyName: 1 } })
        .toArray()
    : [];
  const archivedNameById = new Map(
    archivedDocs.map((c) => [String(c.companyId), String(c.companyName ?? '')])
  );

  const companies: CompanyUsageRow[] = [];
  const unattributed = { ...noCandidate };
  for (const [id, agg] of byCandidate) {
    const liveName = nameById.get(id);
    const archivedName = archivedNameById.get(id);
    if (liveName !== undefined || archivedName !== undefined) {
      companies.push({
        companyId: id,
        companyName: (liveName ?? archivedName) || null,
        archived: liveName === undefined,
        objects: agg.objects,
        bytes: agg.bytes,
        buckets: [...agg.buckets.entries()]
          .map(([bucket, usage]) => ({ bucket, ...usage }))
          .sort((a, b) => b.bytes - a.bytes),
      });
    } else {
      unattributed.objects += agg.objects;
      unattributed.bytes += agg.bytes;
    }
  }
  companies.sort((a, b) => b.bytes - a.bytes);

  return {
    region,
    buckets,
    totals: {
      buckets: buckets.length,
      objects: buckets.reduce((s, b) => s + b.objects, 0),
      bytes: buckets.reduce((s, b) => s + b.bytes, 0),
    },
    companies,
    unattributed,
    generatedAt: new Date().toISOString(),
  };
}

function startRefresh(db: Db): Promise<AwsAnalytics> {
  if (!refreshInFlight) {
    refreshInFlight = computeAwsAnalytics(db)
      .then((data) => {
        cache = { data, cachedAt: Date.now() };
        return data;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

/**
 * Serves from cache when fresh; when stale, returns the cached snapshot
 * immediately and refreshes in the background (stale-while-revalidate), so
 * the page never waits for a full account scan except on the very first load.
 */
export async function getAwsAnalytics(db: Db, forceRefresh = false): Promise<AwsAnalytics> {
  if (forceRefresh) {
    return startRefresh(db);
  }
  if (cache) {
    if (Date.now() - cache.cachedAt >= CACHE_TTL_MS) {
      void startRefresh(db).catch(() => {});
    }
    return cache.data;
  }
  return startRefresh(db);
}

/** Single company's usage row from the (possibly cached) account-wide scan. */
export async function getCompanyAwsUsage(
  db: Db,
  companyId: string
): Promise<CompanyUsageRow | null> {
  const analytics = await getAwsAnalytics(db);
  return analytics.companies.find((c) => c.companyId === companyId.toLowerCase()) ?? null;
}

/**
 * Same lookup as getCompanyAwsUsage, but never blocks on a full account-wide
 * scan — used where response time matters more than freshness (e.g. the
 * company deletion preview). Returns null immediately if the cache hasn't
 * been warmed yet, kicking off a background refresh so a later call (or the
 * AWS Analytics page) finds it ready.
 */
export async function peekCompanyAwsUsage(
  db: Db,
  companyId: string
): Promise<CompanyUsageRow | null> {
  if (!cache) {
    void startRefresh(db).catch(() => {});
    return null;
  }
  if (Date.now() - cache.cachedAt >= CACHE_TTL_MS) {
    void startRefresh(db).catch(() => {});
  }
  return cache.data.companies.find((c) => c.companyId === companyId.toLowerCase()) ?? null;
}

/** Every object key belonging to this company within one bucket, paginated with the same safety cap as a full bucket scan. */
async function collectCompanyKeysInBucket(
  client: S3Client,
  bucketName: string,
  companyId: string
): Promise<{ key: string; size: number }[]> {
  const matches: { key: string; size: number }[] = [];
  let token: string | undefined;
  let pages = 0;
  do {
    const res = await client.send(
      new ListObjectsV2Command({ Bucket: bucketName, ContinuationToken: token, MaxKeys: 1000 })
    );
    pages += 1;
    for (const obj of res.Contents ?? []) {
      if (obj.Key && keyBelongsToCompany(obj.Key, companyId)) {
        matches.push({ key: obj.Key, size: obj.Size ?? 0 });
      }
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
    if (pages >= MAX_PAGES_PER_BUCKET && token) break;
  } while (token);
  return matches;
}

/**
 * Buckets that hold this company's LIVE data — excludes AWS_BACKUP_BUCKET,
 * whose contents are, by construction, keyed by companyId too (so they'd
 * otherwise look like more of "this company's data" to delete/copy). The
 * backup bucket still shows up in getCompanyAwsUsage for display/attribution
 * in AWS Analytics; it's only excluded from these operational paths.
 */
function excludeBackupBucket(buckets: CompanyBucketUsage[]): CompanyBucketUsage[] {
  const backupBucket = (process.env.AWS_BACKUP_BUCKET || '').trim();
  if (!backupBucket) return buckets;
  return buckets.filter((b) => b.bucket !== backupBucket);
}

/**
 * Every real {bucket, key, size} for a company's S3 objects, across only the
 * buckets the cached account-wide scan already found it in. Used by Archive
 * to know exactly what to copy into the backup bucket before anything is
 * deleted (deleteCompanyObjects only needs keys transiently; this exposes
 * them to a caller).
 */
export async function listCompanyObjectLocations(
  db: Db,
  companyId: string
): Promise<{ bucket: string; key: string; size: number }[]> {
  const usage = await getCompanyAwsUsage(db, companyId);
  const buckets = excludeBackupBucket(usage?.buckets ?? []);
  if (buckets.length === 0) return [];

  const setup = createClient();
  if (!setup) {
    throw new Error('AWS credentials are not configured');
  }
  const { client } = setup;

  const perBucket = await Promise.all(
    buckets.map(async ({ bucket }) => {
      const keys = await collectCompanyKeysInBucket(client, bucket, companyId);
      return keys.map((k) => ({ bucket, key: k.key, size: k.size }));
    })
  );

  return perBucket.flat();
}

/**
 * Permanently deletes every S3 object belonging to this company, across only
 * the buckets the cached account-wide scan already found it in (excluding
 * the backup bucket — see excludeBackupBucket). Invalidates that cache
 * afterward so the next analytics view reflects the deletion.
 */
export async function deleteCompanyObjects(
  db: Db,
  companyId: string
): Promise<{ deletedObjects: number; deletedBytes: number; errors: string[] }> {
  const usage = await getCompanyAwsUsage(db, companyId);
  const buckets = excludeBackupBucket(usage?.buckets ?? []);
  if (buckets.length === 0) {
    return { deletedObjects: 0, deletedBytes: 0, errors: [] };
  }

  const setup = createClient();
  if (!setup) {
    throw new Error('AWS credentials are not configured');
  }
  const { client } = setup;

  let deletedObjects = 0;
  let deletedBytes = 0;
  const errors: string[] = [];

  for (const { bucket } of buckets) {
    try {
      const keys = await collectCompanyKeysInBucket(client, bucket, companyId);
      for (let i = 0; i < keys.length; i += 1000) {
        const batch = keys.slice(i, i + 1000);
        const res = await client.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: batch.map((k) => ({ Key: k.key })), Quiet: true },
          })
        );
        const failedKeys = new Set((res.Errors ?? []).map((e) => e.Key));
        for (const k of batch) {
          if (!failedKeys.has(k.key)) {
            deletedObjects += 1;
            deletedBytes += k.size;
          }
        }
        for (const err of res.Errors ?? []) {
          errors.push(`${bucket}/${err.Key}: ${err.Message}`);
        }
      }
    } catch (err) {
      errors.push(`${bucket}: ${err instanceof Error ? err.message : 'Failed to delete objects'}`);
    }
  }

  cache = null;

  return { deletedObjects, deletedBytes, errors };
}
