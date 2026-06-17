import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Changelog from '@/lib/models/Changelog';
import { getServerSession } from '@/lib/auth';
import { normalizeItems } from '@/lib/changelog-utils';

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await dbConnect();
  const entries = await Changelog.find().sort({ createdAt: -1 }).lean();
  // Normalize any legacy string items to objects so the UI never receives raw strings.
  const normalized = entries.map((e) => ({
    ...e,
    features: normalizeItems(e.features),
    fixes: normalizeItems(e.fixes),
    improvements: normalizeItems(e.improvements),
  }));
  return NextResponse.json({ data: normalized });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await dbConnect();
  const { version, date, features, fixes, improvements, isPublished } = await request.json();
  if (!version || !date) return NextResponse.json({ error: 'version and date are required' }, { status: 400 });
  const existing = await Changelog.findOne({ version });
  if (existing) return NextResponse.json({ error: 'Version already exists' }, { status: 409 });
  const entry = await Changelog.create({ version, date, features: normalizeItems(features), fixes: normalizeItems(fixes), improvements: normalizeItems(improvements), isPublished: isPublished !== false });
  return NextResponse.json({ data: entry }, { status: 201 });
}
