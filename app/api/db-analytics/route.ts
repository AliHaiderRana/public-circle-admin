import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import { requireSuperAdminSession } from '@/lib/auth';

type CollectionAnalytics = {
  name: string;
  count: number;
  size: number;
  avgObjSize: number;
  storageSize: number;
  freeStorageSize: number;
  totalIndexSize: number;
  nindexes: number;
  indexSizes: Record<string, number>;
  capped: boolean;
  error?: string;
};

export async function GET() {
  const { error } = await requireSuperAdminSession();
  if (error) return error;

  try {
    await dbConnect();
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database connection unavailable' }, { status: 500 });
    }

    const [dbStats, collectionInfos] = await Promise.all([
      db.command({ dbStats: 1 }),
      db.listCollections({}, { nameOnly: true }).toArray(),
    ]);

    const collections: CollectionAnalytics[] = await Promise.all(
      collectionInfos
        .filter((info) => info.type !== 'view')
        .map(async (info) => {
          const empty: CollectionAnalytics = {
            name: info.name,
            count: 0,
            size: 0,
            avgObjSize: 0,
            storageSize: 0,
            freeStorageSize: 0,
            totalIndexSize: 0,
            nindexes: 0,
            indexSizes: {},
            capped: false,
          };
          try {
            const [stats] = await db
              .collection(info.name)
              .aggregate([{ $collStats: { storageStats: {}, count: {} } }])
              .toArray();
            const storage = (stats?.storageStats ?? {}) as Record<string, unknown>;
            return {
              ...empty,
              count: Number(stats?.count ?? storage.count ?? 0),
              size: Number(storage.size ?? 0),
              avgObjSize: Number(storage.avgObjSize ?? 0),
              storageSize: Number(storage.storageSize ?? 0),
              freeStorageSize: Number(storage.freeStorageSize ?? 0),
              totalIndexSize: Number(storage.totalIndexSize ?? 0),
              nindexes: Number(storage.nindexes ?? 0),
              indexSizes: (storage.indexSizes ?? {}) as Record<string, number>,
              capped: Boolean(storage.capped),
            };
          } catch (err) {
            return {
              ...empty,
              error: err instanceof Error ? err.message : 'Failed to read collection stats',
            };
          }
        })
    );

    collections.sort(
      (a, b) => b.storageSize + b.totalIndexSize - (a.storageSize + a.totalIndexSize)
    );

    return NextResponse.json({
      database: {
        name: String(dbStats.db ?? ''),
        collections: Number(dbStats.collections ?? collections.length),
        views: Number(dbStats.views ?? 0),
        objects: Number(dbStats.objects ?? 0),
        avgObjSize: Number(dbStats.avgObjSize ?? 0),
        dataSize: Number(dbStats.dataSize ?? 0),
        storageSize: Number(dbStats.storageSize ?? 0),
        indexes: Number(dbStats.indexes ?? 0),
        indexSize: Number(dbStats.indexSize ?? 0),
        totalSize: Number(dbStats.totalSize ?? 0),
        fsUsedSize: Number(dbStats.fsUsedSize ?? 0),
        fsTotalSize: Number(dbStats.fsTotalSize ?? 0),
      },
      collections,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[db-analytics]', err);
    return NextResponse.json({ error: 'Failed to load database analytics' }, { status: 500 });
  }
}
