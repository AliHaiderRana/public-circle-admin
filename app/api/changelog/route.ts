import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Changelog from '@/lib/models/Changelog';
import { getServerSession } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  const entries = await Changelog.find().sort({ createdAt: -1 }).lean();
  return NextResponse.json({ data: entries });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  const body = await request.json();
  const { version, date, features, fixes, improvements, isPublished } = body;

  if (!version || !date) {
    return NextResponse.json({ error: 'version and date are required' }, { status: 400 });
  }

  const existing = await Changelog.findOne({ version });
  if (existing) {
    return NextResponse.json({ error: 'Version already exists' }, { status: 409 });
  }

  const entry = await Changelog.create({
    version,
    date,
    features: features || [],
    fixes: fixes || [],
    improvements: improvements || [],
    isPublished: isPublished !== false,
  });

  return NextResponse.json({ data: entry }, { status: 201 });
}
