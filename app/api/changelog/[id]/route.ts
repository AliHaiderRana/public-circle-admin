import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Changelog from '@/lib/models/Changelog';
import { getServerSession } from '@/lib/auth';
import { normalizeItems } from '@/lib/changelog-utils';

type MetaMap = Record<string, { commitSha?: string | null; commitAuthor?: string | null; commitAuthorEmail?: string | null; commitDate?: string | null }>;

function buildMetaMap(items: { text: string; commitSha?: string | null; commitAuthor?: string | null; commitAuthorEmail?: string | null; commitDate?: string | null }[]): MetaMap {
  const map: MetaMap = {};
  for (const item of items) {
    if (item.text && (item.commitSha || item.commitAuthor || item.commitDate)) {
      map[item.text] = { commitSha: item.commitSha, commitAuthor: item.commitAuthor, commitAuthorEmail: item.commitAuthorEmail, commitDate: item.commitDate };
    }
  }
  return map;
}

function mergeMetadata(normalized: ReturnType<typeof normalizeItems>, metaMap: MetaMap) {
  return normalized.map(item => {
    const existing = metaMap[item.text];
    if (!existing) return item;
    return { ...item, ...existing };
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await dbConnect();
  const body = await request.json();

  // Fetch existing entry to preserve commit metadata on items that haven't changed text
  const existing = await Changelog.findById(id).lean() as any;
  if (body.features !== undefined) {
    const normalized = normalizeItems(body.features);
    body.features = existing ? mergeMetadata(normalized, buildMetaMap(existing.features || [])) : normalized;
  }
  if (body.fixes !== undefined) {
    const normalized = normalizeItems(body.fixes);
    body.fixes = existing ? mergeMetadata(normalized, buildMetaMap(existing.fixes || [])) : normalized;
  }
  if (body.improvements !== undefined) {
    const normalized = normalizeItems(body.improvements);
    body.improvements = existing ? mergeMetadata(normalized, buildMetaMap(existing.improvements || [])) : normalized;
  }

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
