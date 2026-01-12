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
    
    // Check both collections
    const emailsSentCount = await db.collection('emails-sent').countDocuments();
    const emailsSentsCount = await db.collection('emails-sents').countDocuments();
    
    // Get sample from both
    const emailsSentSample = await db.collection('emails-sent').findOne({});
    const emailsSentsSample = await db.collection('emails-sents').findOne({});
    
    return NextResponse.json({
      message: 'Collection comparison test',
      'emails-sent': {
        count: emailsSentCount,
        hasSample: !!emailsSentSample,
        sampleKeys: emailsSentSample ? Object.keys(emailsSentSample) : []
      },
      'emails-sents': {
        count: emailsSentsCount,
        hasSample: !!emailsSentsSample,
        sampleKeys: emailsSentsSample ? Object.keys(emailsSentsSample) : []
      }
    });
  } catch (error) {
    console.error('Collection comparison error:', error);
    return NextResponse.json({ 
      error: 'Collection comparison failed', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
