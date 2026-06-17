import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import AdminActivity from '@/lib/models/AdminActivity';
import AdminImpersonationActivity from '@/lib/models/AdminImpersonationActivity';
import {
  downloadJsonFromS3,
  uploadJsonToS3WithRetry,
} from '@/lib/s3-json';

export const ADMIN_ACTIVITY_RETENTION_MONTHS = 6;
const S3_ARCHIVE_PREFIX = 'admin-activity-archives';

export type AdminActivityArchiveResult = {
  cutoffDate: string;
  panelArchived: number;
  panelDeleted: number;
  impersonationArchived: number;
  impersonationDeleted: number;
  s3Files: number;
  failedMonths: string[];
};

type ArchivePayload = {
  collection: string;
  period: string;
  totalRecords: number;
  archivedAt: string;
  items: Record<string, unknown>[];
};

function toIdString(id: unknown): string | null {
  if (!id) return null;
  if (typeof id === 'string') return id;
  if (id instanceof mongoose.Types.ObjectId) return id.toHexString();
  if (typeof id === 'object' && id !== null && 'toHexString' in id) {
    const hex = (id as { toHexString?: () => string }).toHexString?.();
    if (hex) return hex;
  }
  const asString = String(id);
  const match = asString.match(/ObjectId\("([0-9a-fA-F]{24})"\)/);
  return match ? match[1] : asString;
}

function ensureIsoString(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  const date = new Date(value as string | number);
  return Number.isNaN(date.valueOf()) ? String(value) : date.toISOString();
}

function normalizeDoc(doc: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(doc)) {
    if (key === '_id' || key.endsWith('Id') || key === 'adminId' || key === 'companyId') {
      normalized[key] = toIdString(value);
      continue;
    }
    if (key === 'createdAt' || key === 'updatedAt') {
      normalized[key] = ensureIsoString(value);
      continue;
    }
    normalized[key] = value;
  }

  return normalized;
}

function getCutoffDate(): Date {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setMonth(cutoff.getMonth() - ADMIN_ACTIVITY_RETENTION_MONTHS);
  return cutoff;
}

function buildS3Path(collectionKey: string, period: string): string {
  return `${S3_ARCHIVE_PREFIX}/${period}/${collectionKey}.json`;
}

async function archiveCollection({
  model,
  collectionKey,
  cutoffDate,
}: {
  model: mongoose.Model<unknown>;
  collectionKey: string;
  cutoffDate: Date;
}): Promise<{
  archived: number;
  deleted: number;
  s3Files: number;
  failedMonths: string[];
}> {
  const monthBuckets = await model.aggregate<{ _id: string }>([
    { $match: { createdAt: { $lt: cutoffDate } } },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m', date: '$createdAt' },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  let archived = 0;
  let deleted = 0;
  let s3Files = 0;
  const failedMonths: string[] = [];

  for (const bucket of monthBuckets) {
    const period = bucket._id;
    if (!period) continue;

    const [year, month] = period.split('-').map(Number);
    if (!year || !month) continue;

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 1);
    const upperBound = monthEnd < cutoffDate ? monthEnd : cutoffDate;

    const eligibleDocs = (await model
      .find({
        createdAt: { $gte: monthStart, $lt: upperBound },
      })
      .lean()) as Record<string, unknown>[];

    if (!eligibleDocs.length) continue;

    const normalizedItems = eligibleDocs.map(normalizeDoc);
    const s3Path = buildS3Path(collectionKey, period);

    let existingPayload: ArchivePayload | null = null;
    try {
      existingPayload = await downloadJsonFromS3<ArchivePayload>({ s3Path });
    } catch (err) {
      failedMonths.push(`${collectionKey}:${period}`);
      console.error(
        `[admin-activity-archive] Failed to read existing S3 file ${s3Path}:`,
        err
      );
      continue;
    }

    const dedupeMap = new Map<string, Record<string, unknown>>();

    if (existingPayload?.items?.length) {
      for (const item of existingPayload.items) {
        const id = toIdString(item._id);
        if (id) dedupeMap.set(id, item);
      }
    }

    for (const item of normalizedItems) {
      const id = toIdString(item._id);
      if (id) dedupeMap.set(id, item);
    }

    const combinedItems = Array.from(dedupeMap.values()).sort((a, b) => {
      const aDate = new Date(String(a.createdAt || 0)).valueOf();
      const bDate = new Date(String(b.createdAt || 0)).valueOf();
      return aDate - bDate;
    });

    const payload: ArchivePayload = {
      collection: collectionKey,
      period,
      totalRecords: combinedItems.length,
      archivedAt: new Date().toISOString(),
      items: combinedItems,
    };

    try {
      await uploadJsonToS3WithRetry({ s3Path, data: payload });
      s3Files += 1;

      const idsToDelete = eligibleDocs
        .map((doc) => doc._id)
        .filter((id) => id != null) as mongoose.Types.ObjectId[];

      if (idsToDelete.length) {
        const deleteResult = await model.deleteMany({ _id: { $in: idsToDelete } });
        deleted += deleteResult.deletedCount || 0;
      }

      archived += eligibleDocs.length;
      await new Promise((resolve) => setTimeout(resolve, 150));
    } catch (err) {
      failedMonths.push(`${collectionKey}:${period}`);
      console.error(
        `[admin-activity-archive] Failed to upload ${s3Path}:`,
        err
      );
    }
  }

  return { archived, deleted, s3Files, failedMonths };
}

export async function archiveAdminActivityLogs(): Promise<AdminActivityArchiveResult> {
  await dbConnect();

  const cutoffDate = getCutoffDate();

  const [panelResult, impersonationResult] = await Promise.all([
    archiveCollection({
      model: AdminActivity,
      collectionKey: 'admin-panel-activities',
      cutoffDate,
    }),
    archiveCollection({
      model: AdminImpersonationActivity,
      collectionKey: 'impersonation-activities',
      cutoffDate,
    }),
  ]);

  return {
    cutoffDate: cutoffDate.toISOString(),
    panelArchived: panelResult.archived,
    panelDeleted: panelResult.deleted,
    impersonationArchived: impersonationResult.archived,
    impersonationDeleted: impersonationResult.deleted,
    s3Files: panelResult.s3Files + impersonationResult.s3Files,
    failedMonths: [...panelResult.failedMonths, ...impersonationResult.failedMonths],
  };
}
