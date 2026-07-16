import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import { requireSuperAdminSession } from '@/lib/auth';
import { computeExactCompanySizes, getCompanyStats } from '@/lib/db-analytics.server';

/**
 * Runs the exact per-company size computation (full $bsonSize scan) for one
 * collection and caches the result. Explicit admin action — may take up to
 * two minutes on very large collections.
 */
export async function POST(request: Request) {
  const { error } = await requireSuperAdminSession();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const name = (searchParams.get('name') || '').trim();
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
    const cache = await computeExactCompanySizes(coll, db, name);
    if (!cache) {
      return NextResponse.json(
        { error: 'No company field detected in this collection' },
        { status: 400 }
      );
    }

    // Return the merged view (live counts + fresh exact sizes) so the client
    // can swap it straight into state.
    const companyStats = await getCompanyStats(coll, db, name);
    return NextResponse.json({ name, companyStats, durationMs: cache.durationMs });
  } catch (err) {
    console.error('[db-analytics/collection/company-sizes]', err);
    const message =
      err instanceof Error && /maxTimeMS|operation exceeded/i.test(err.message)
        ? 'Computation timed out (2 min limit) — the collection is too large'
        : 'Failed to compute company sizes';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
