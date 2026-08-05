import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { requireSuperAdminSession } from '@/lib/auth';
import { isSystemDatabase, resolveDb } from '@/lib/db-analytics.server';

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

export async function GET(request: Request) {
  const { error } = await requireSuperAdminSession();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const databaseName = (searchParams.get('database') || '').trim();
    if (databaseName && isSystemDatabase(databaseName)) {
      return NextResponse.json({ error: 'That database is not available here' }, { status: 400 });
    }

    await dbConnect();
    const db = resolveDb(databaseName || undefined);

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

    // Same default ordering as Compass: storage size, largest first
    collections.sort((a, b) => b.storageSize - a.storageSize);

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
        // Atlas defines "Data Size" as dataSize + indexSize (see
        // https://www.mongodb.com/docs/atlas/reference/faq/storage/) — not
        // dbStats.totalSize, which is storageSize + indexSize instead.
        totalSize: Number(dbStats.dataSize ?? 0) + Number(dbStats.indexSize ?? 0),
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
