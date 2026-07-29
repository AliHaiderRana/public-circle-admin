import Stripe from 'stripe';
import mongoose from 'mongoose';
import { EJSON } from 'bson';
import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import dbConnect from '@/lib/db';
import Company from '@/lib/models/Company';
import ArchivedCompany from '@/lib/models/ArchivedCompany';
import { USER_STATUS } from '@/lib/constants';
import { runWithOptionalTransaction } from '@/lib/run-with-optional-transaction';
import {
  detectCompanyReferencingCollections,
  deleteCompanyDbFootprint,
} from '@/lib/db-analytics.server';
import {
  createClient,
  deleteCompanyObjects,
  listCompanyObjectLocations,
} from '@/lib/aws-analytics.server';
import {
  listCancelableSubscriptions,
  cancelCompanySubscriptions,
} from '@/lib/company-deletion.server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

/**
 * AWS_BACKUP_BUCKET is set per deployment (public-circle-admin-staging vs
 * public-circle-admin-production), matching this app's existing per-env
 * bucket convention — so the path within it needs no separate staging/prod
 * folder, just companies/<companyId>/.
 */
function getBackupBucket(): string {
  const bucket = (process.env.AWS_BACKUP_BUCKET || '').trim();
  if (!bucket) throw new Error('AWS_BACKUP_BUCKET is not configured');
  return bucket;
}

/** Encodes each path segment individually so CopySource stays valid for keys containing slashes. */
function encodeS3Path(key: string): string {
  return key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

async function listAllKeysUnderPrefix(
  client: S3Client,
  bucket: string,
  prefix: string
): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const res = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token, MaxKeys: 1000 })
    );
    for (const obj of res.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key);
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function deleteAllUnderPrefix(client: S3Client, bucket: string, prefix: string): Promise<void> {
  const keys = await listAllKeysUnderPrefix(client, bucket, prefix);
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000);
    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: batch.map((k) => ({ Key: k })), Quiet: true },
      })
    );
  }
}

type DbBackupRow = { collectionName: string; field: string; count: number };

export type CompanyArchiveResult = {
  companyName: string;
  archivedCompanyId: string;
  backupPrefix: string;
  db: {
    backedUpDocuments: number;
    backedUpCollections: string[];
    deletedDocuments: number;
    deletedCollections: string[];
  };
  aws: {
    backedUpObjects: number;
    backedUpBytes: number;
    deletedObjects: number;
    deletedBytes: number;
    errors: string[];
  };
  stripe: { cancelled: number; errors: string[] };
};

/**
 * Archives a company: backs up its MongoDB documents and S3 files to
 * AWS_BACKUP_BUCKET (backup-first — nothing live is touched until every
 * backup write succeeds), then cancels its Stripe subscriptions and removes
 * the live DB/S3 data, same as performCompanyDeletion. Recoverable via
 * performCompanyRestore using the ArchivedCompany record this creates.
 */
export async function performCompanyArchive(
  companyId: string,
  adminEmail: string
): Promise<CompanyArchiveResult> {
  await dbConnect();

  const backupBucket = getBackupBucket();
  const setup = createClient();
  if (!setup) throw new Error('AWS credentials are not configured');
  const { client } = setup;

  const company = await Company.findById(companyId).lean<{
    _id: mongoose.Types.ObjectId;
    name: string;
    status: string;
    stripeCustomerId?: string;
  }>();
  if (!company) throw new Error('Company not found');

  const db = mongoose.connection.db;
  if (!db) throw new Error('Database connection unavailable');

  const prefix = `companies/${companyId}/`;
  const objectId = new mongoose.Types.ObjectId(companyId);

  // --- Step 1: back up MongoDB documents ---
  const referencing = await detectCompanyReferencingCollections();
  const collectionsToBackUp = [{ name: 'companies', field: '_id' }, ...referencing];

  let companyDocForStub: Record<string, unknown> | null = null;

  const dbBackupRows = (
    await Promise.all(
      collectionsToBackUp.map(async ({ name, field }): Promise<DbBackupRow | null> => {
        const docs = await db.collection(name).find({ [field]: objectId }).toArray();
        if (docs.length === 0) return null;
        const body = EJSON.stringify(docs, { relaxed: false });
        await client.send(
          new PutObjectCommand({
            Bucket: backupBucket,
            Key: `${prefix}db/${name}.json`,
            Body: body,
            ContentType: 'application/json',
          })
        );
        if (name === 'companies') {
          companyDocForStub = docs[0] as Record<string, unknown>;
        }
        return { collectionName: name, field, count: docs.length };
      })
    )
  ).filter((r): r is DbBackupRow => r !== null);

  // --- Step 2: back up S3 objects (copy only — originals untouched so far) ---
  const objectLocations = await listCompanyObjectLocations(db, companyId);
  const awsBackupErrors: string[] = [];
  let backedUpObjects = 0;
  let backedUpBytes = 0;

  await Promise.all(
    objectLocations.map(async ({ bucket, key, size }) => {
      try {
        await client.send(
          new CopyObjectCommand({
            Bucket: backupBucket,
            Key: `${prefix}aws/${bucket}/${key}`,
            CopySource: `${bucket}/${encodeS3Path(key)}`,
          })
        );
        backedUpObjects += 1;
        backedUpBytes += size;
      } catch (err) {
        awsBackupErrors.push(`${bucket}/${key}: ${err instanceof Error ? err.message : 'Failed to back up'}`);
      }
    })
  );

  if (awsBackupErrors.length > 0) {
    throw new Error(
      `Aborted before removing any live data — failed to back up ${awsBackupErrors.length} S3 object(s): ${awsBackupErrors.slice(0, 3).join('; ')}`
    );
  }

  // --- Step 3: capture the Stripe manifest, then cancel ---
  const stripeSubscriptions = company.stripeCustomerId
    ? await listCancelableSubscriptions(company.stripeCustomerId)
    : [];
  const stripeResult = company.stripeCustomerId
    ? await cancelCompanySubscriptions(company.stripeCustomerId)
    : { cancelled: 0, errors: [] };

  // --- Step 4: remove originals now that backups are confirmed ---
  const awsDeleteResult = await deleteCompanyObjects(db, companyId).catch((err) => ({
    deletedObjects: 0,
    deletedBytes: 0,
    errors: [err instanceof Error ? err.message : 'Failed to delete S3 objects'],
  }));

  // Delete everything (including the company document itself), then
  // immediately re-insert a stub for the company — marked ARCHIVED — so it
  // stays visible and actionable (Restore) in the normal Companies list.
  // Every other collection stays fully removed. Wrapped together so a
  // transaction-supporting deployment rolls back the delete if the stub
  // insert fails, rather than leaving the company vanished entirely.
  const dbDeleteResult = await runWithOptionalTransaction(async (session) => {
    const result = await deleteCompanyDbFootprint(companyId, session);
    if (companyDocForStub) {
      await db.collection('companies').insertOne(
        { ...companyDocForStub, status: USER_STATUS.ARCHIVED },
        session ? { session } : undefined
      );
    }
    return result;
  });

  // --- Step 5: manifest + ArchivedCompany record ---
  const stripeManifest = stripeSubscriptions.map((s) => ({
    originalSubscriptionId: s.id,
    status: s.status,
    items: s.items,
  }));

  await client.send(
    new PutObjectCommand({
      Bucket: backupBucket,
      Key: `${prefix}manifest.json`,
      Body: JSON.stringify(
        {
          companyId,
          companyName: company.name,
          archivedAt: new Date().toISOString(),
          archivedBy: adminEmail,
          dbCollections: dbBackupRows,
          awsObjectCount: backedUpObjects,
          awsBytes: backedUpBytes,
          stripeCustomerId: company.stripeCustomerId ?? null,
          stripeSubscriptions: stripeManifest,
        },
        null,
        2
      ),
      ContentType: 'application/json',
    })
  );

  const archived = await ArchivedCompany.create({
    companyId,
    companyName: company.name,
    companyStatus: company.status,
    archivedAt: new Date(),
    archivedBy: adminEmail,
    backupBucket,
    backupPrefix: prefix,
    dbCollections: dbBackupRows,
    awsObjectCount: backedUpObjects,
    awsBytes: backedUpBytes,
    stripeCustomerId: company.stripeCustomerId ?? null,
    stripeSubscriptions: stripeManifest,
    status: 'archived',
  });

  return {
    companyName: company.name,
    archivedCompanyId: String(archived._id),
    backupPrefix: prefix,
    db: {
      backedUpDocuments: dbBackupRows.reduce((s, r) => s + r.count, 0),
      backedUpCollections: dbBackupRows.map((r) => r.collectionName),
      deletedDocuments: dbDeleteResult.deletedDocuments,
      deletedCollections: dbDeleteResult.deletedCollections,
    },
    aws: {
      backedUpObjects,
      backedUpBytes,
      deletedObjects: awsDeleteResult.deletedObjects,
      deletedBytes: awsDeleteResult.deletedBytes,
      errors: awsDeleteResult.errors,
    },
    stripe: stripeResult,
  };
}

export async function getArchivedCompanies() {
  await dbConnect();
  return ArchivedCompany.find({}).sort({ archivedAt: -1 }).lean();
}

/** The active (not-yet-restored) archive record for a company, if any — used to power the Restore action from the company detail page. */
export async function getActiveArchiveRecord(companyId: string) {
  await dbConnect();
  return ArchivedCompany.findOne({ companyId, status: 'archived' })
    .sort({ archivedAt: -1 })
    .lean();
}

export type CompanyRestoreResult = {
  companyName: string;
  db: { restoredDocuments: number; restoredCollections: string[] };
  aws: { restoredObjects: number; errors: string[] };
  stripe: { createdSubscriptions: number; errors: string[] };
};

/**
 * Restores an archived company: re-inserts its MongoDB documents, copies its
 * S3 files back to their original locations, and recreates its Stripe
 * subscription(s) on the same customer (new subscription ids — Stripe has no
 * "un-cancel"; billed immediately). Deletes the backup files only once every
 * step succeeds; on partial failure the backups are kept and the record is
 * marked restore_failed with per-step errors so nothing is silently lost.
 */
export async function performCompanyRestore(
  archivedCompanyId: string,
  adminEmail: string
): Promise<CompanyRestoreResult> {
  await dbConnect();

  const record = await ArchivedCompany.findById(archivedCompanyId);
  if (!record) throw new Error('Archived company record not found');
  if (record.status !== 'archived') {
    throw new Error(`This company is not in an archived state (status: ${record.status})`);
  }

  const setup = createClient();
  if (!setup) throw new Error('AWS credentials are not configured');
  const { client } = setup;

  const db = mongoose.connection.db;
  if (!db) throw new Error('Database connection unavailable');

  const restoreErrors: string[] = [];

  // --- Step 1: restore MongoDB documents (company doc first) ---
  let restoredDocuments = 0;
  const restoredCollections: string[] = [];
  const orderedCollections = [
    ...record.dbCollections.filter((c: { collectionName: string }) => c.collectionName === 'companies'),
    ...record.dbCollections.filter((c: { collectionName: string }) => c.collectionName !== 'companies'),
  ];

  try {
    await runWithOptionalTransaction(async (session) => {
      for (const { collectionName } of orderedCollections) {
        if (collectionName === 'companies') {
          // The company document was kept alive as an ARCHIVED stub during
          // archive — restore just needs its original status back, not a
          // fresh insert (which would collide on _id).
          const result = await db.collection('companies').updateOne(
            { _id: new mongoose.Types.ObjectId(record.companyId) },
            { $set: { status: record.companyStatus || USER_STATUS.ACTIVE } },
            session ? { session } : undefined
          );
          if (result.matchedCount > 0) {
            restoredDocuments += 1;
            restoredCollections.push('companies');
          }
          continue;
        }

        const obj = await client.send(
          new GetObjectCommand({
            Bucket: record.backupBucket,
            Key: `${record.backupPrefix}db/${collectionName}.json`,
          })
        );
        const body = await obj.Body?.transformToString();
        if (!body) continue;
        const docs = EJSON.parse(body, { relaxed: false }) as Record<string, unknown>[];
        if (docs.length === 0) continue;
        await db.collection(collectionName).insertMany(docs, session ? { session } : undefined);
        restoredDocuments += docs.length;
        restoredCollections.push(collectionName);
      }
    });
  } catch (err) {
    restoreErrors.push(
      `MongoDB restore failed: ${err instanceof Error ? err.message : 'Unknown error'}`
    );
  }

  // --- Step 2: restore S3 objects ---
  let restoredObjects = 0;
  const awsErrors: string[] = [];
  const awsPrefix = `${record.backupPrefix}aws/`;
  const backedUpKeys = await listAllKeysUnderPrefix(client, record.backupBucket, awsPrefix);

  await Promise.all(
    backedUpKeys.map(async (backupKey) => {
      const relative = backupKey.slice(awsPrefix.length);
      const slashIdx = relative.indexOf('/');
      if (slashIdx === -1) return;
      const originalBucket = relative.slice(0, slashIdx);
      const originalKey = relative.slice(slashIdx + 1);
      try {
        await client.send(
          new CopyObjectCommand({
            Bucket: originalBucket,
            Key: originalKey,
            CopySource: `${record.backupBucket}/${encodeS3Path(backupKey)}`,
          })
        );
        restoredObjects += 1;
      } catch (err) {
        awsErrors.push(
          `${originalBucket}/${originalKey}: ${err instanceof Error ? err.message : 'Failed to restore'}`
        );
      }
    })
  );
  restoreErrors.push(...awsErrors);

  // --- Step 3: recreate Stripe subscriptions ---
  let createdSubscriptions = 0;
  const stripeErrors: string[] = [];
  if (record.stripeCustomerId) {
    for (const sub of record.stripeSubscriptions) {
      const items = sub.items
        .filter((i: { priceId?: string | null }) => i.priceId)
        .map((i: { priceId?: string | null; quantity?: number }) => ({
          price: i.priceId as string,
          quantity: i.quantity || 1,
        }));
      if (items.length === 0) continue;
      try {
        await stripe.subscriptions.create({ customer: record.stripeCustomerId, items });
        createdSubscriptions += 1;
      } catch (err) {
        stripeErrors.push(
          `${sub.originalSubscriptionId}: ${err instanceof Error ? err.message : 'Failed to recreate'}`
        );
      }
    }
  }
  restoreErrors.push(...stripeErrors);

  // --- Step 4: finalize ---
  if (restoreErrors.length === 0) {
    await deleteAllUnderPrefix(client, record.backupBucket, record.backupPrefix);
    record.status = 'restored';
    record.restoredAt = new Date();
    record.restoredBy = adminEmail;
    record.restoreErrors = [];
  } else {
    record.status = 'restore_failed';
    record.restoreErrors = restoreErrors;
  }
  await record.save();

  return {
    companyName: record.companyName,
    db: { restoredDocuments, restoredCollections },
    aws: { restoredObjects, errors: awsErrors },
    stripe: { createdSubscriptions, errors: stripeErrors },
  };
}
