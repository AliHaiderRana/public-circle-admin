import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import type { Collection } from 'mongodb';
import dbConnect from '@/lib/db';
import { requireSuperAdminSession } from '@/lib/auth';
import { getCompanyStats } from '@/lib/db-analytics.server';

/** Storage/index metadata straight from $collStats — no document reads, effectively instant. */
async function getStorageStats(coll: Collection, name: string, totalCount: number) {
  try {
    const [collStats] = await coll
      .aggregate([{ $collStats: { storageStats: {}, count: {} } }])
      .toArray();
    const s = (collStats?.storageStats ?? {}) as Record<string, unknown>;
    return {
      name,
      count: Number(collStats?.count ?? s.count ?? totalCount),
      size: Number(s.size ?? 0),
      avgObjSize: Number(s.avgObjSize ?? 0),
      storageSize: Number(s.storageSize ?? 0),
      freeStorageSize: Number(s.freeStorageSize ?? 0),
      totalIndexSize: Number(s.totalIndexSize ?? 0),
      nindexes: Number(s.nindexes ?? 0),
      indexSizes: (s.indexSizes ?? {}) as Record<string, number>,
      capped: Boolean(s.capped),
    };
  } catch {
    return {
      name,
      count: totalCount,
      size: 0,
      avgObjSize: 0,
      storageSize: 0,
      freeStorageSize: 0,
      totalIndexSize: 0,
      nindexes: 0,
      indexSizes: {},
      capped: false,
    };
  }
}

export async function GET(request: Request) {
  const { error } = await requireSuperAdminSession();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const name = (searchParams.get('name') || '').trim();
    const section = (searchParams.get('section') || 'storage').trim();
    if (!name) {
      return NextResponse.json({ error: 'name query param is required' }, { status: 400 });
    }

    await dbConnect();
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database connection unavailable' }, { status: 500 });
    }

    const existing = await db.listCollections({}, { nameOnly: true }).toArray();
    if (!existing.some((c) => c.name === name && c.type !== 'view')) {
      return NextResponse.json({ error: 'Unknown collection' }, { status: 404 });
    }

    const coll = db.collection(name);

    if (section === 'companies') {
      const companyStats = await getCompanyStats(coll, db, name);
      return NextResponse.json({ name, companyStats });
    }

    const totalCount = await coll.estimatedDocumentCount();
    const storage = await getStorageStats(coll, name, totalCount);
    return NextResponse.json({ name, storage, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[db-analytics/collection]', err);
    const message =
      err instanceof Error && /maxTimeMS|operation exceeded/i.test(err.message)
        ? 'Timed out — the collection is too large to analyze right now'
        : 'Failed to load collection analytics';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
