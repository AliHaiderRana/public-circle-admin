import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import EmailsSent from '@/lib/models/EmailsSent';
import { getServerSession } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  try {
    // Test basic connection and count
    const totalEmails = await EmailsSent.countDocuments({});
    const sampleEmail = await EmailsSent.findOne({});
    
    return NextResponse.json({
      message: 'Database connection test',
      totalEmails,
      hasSampleEmail: !!sampleEmail,
      sampleEmailKeys: sampleEmail ? Object.keys(sampleEmail.toObject()) : [],
      emailEvents: sampleEmail?.emailEvents || null
    });
  } catch (error) {
    console.error('Database test error:', error);
    return NextResponse.json({ 
      error: 'Database test failed', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
