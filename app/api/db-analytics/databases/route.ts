import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import { requireSuperAdminSession } from '@/lib/auth';
import {
  getClusterName,
  getClusterWideStats,
  listClusterDatabases,
} from '@/lib/db-analytics.server';

export async function GET() {
  const { error } = await requireSuperAdminSession();
  if (error) return error;

  try {
    await dbConnect();
    const databases = await listClusterDatabases();
    const current = mongoose.connection.db?.databaseName ?? '';
    const cluster = getClusterName();
    const clusterStats = await getClusterWideStats(databases);
    return NextResponse.json({ databases, current, cluster, clusterStats });
  } catch (err) {
    console.error('[db-analytics/databases]', err);
    return NextResponse.json({ error: 'Failed to list databases' }, { status: 500 });
  }
}
