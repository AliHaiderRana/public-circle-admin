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
    
    // Direct collection access - this should work
    const collection = db.collection('emails-sent');
    const totalEmails = await collection.countDocuments({});
    
    // Test with emailEvents query
    const withBounce = await collection.countDocuments({ 'emailEvents.Bounce': { $exists: true } });
    const withComplaint = await collection.countDocuments({ 'emailEvents.Complaint': { $exists: true } });
    
    return NextResponse.json({
      message: 'Direct collection test',
      totalEmails,
      withBounce,
      withComplaint,
      bounceRate: totalEmails > 0 ? (withBounce / totalEmails * 100).toFixed(2) : '0',
      complaintRate: totalEmails > 0 ? (withComplaint / totalEmails * 100).toFixed(2) : '0'
    });
  } catch (error) {
    console.error('Direct collection error:', error);
    return NextResponse.json({ 
      error: 'Direct collection failed', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
