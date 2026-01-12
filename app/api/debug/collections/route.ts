import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';
import { getServerSession } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  try {
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'No database connection' }, { status: 500 });
    }
    const collections = await db.listCollections().toArray();
    
    return NextResponse.json({
      message: 'Database collections test',
      collections: collections.map(c => c.name),
      totalCollections: collections.length
    });
  } catch (error) {
    console.error('Collections test error:', error);
    return NextResponse.json({ 
      error: 'Collections test failed', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
