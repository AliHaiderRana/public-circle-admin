import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Changelog from '@/lib/models/Changelog';
import { getServerSession } from '@/lib/auth';
import { normalizeItems } from '@/lib/changelog-utils';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await dbConnect();
  const body = await request.json();
  if (body.features) body.features = normalizeItems(body.features);
  if (body.fixes) body.fixes = normalizeItems(body.fixes);
  if (body.improvements) body.improvements = normalizeItems(body.improvements);
  const entry = await Changelog.findByIdAndUpdate(id, { $set: body }, { new: true, runValidators: false });
  if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ data: entry });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await dbConnect();
  const entry = await Changelog.findByIdAndDelete(id);
  if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ data: {} });
}
