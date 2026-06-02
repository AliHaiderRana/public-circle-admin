import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import dbConnect from '@/lib/db';
import { deleteUiTermDoc, readAllUiTerms, upsertUiTermDoc } from '@/lib/ui-term-defaults';

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await dbConnect();
    const terms = await readAllUiTerms();
    return NextResponse.json({ terms });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load UI hints';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await request.json();
    await dbConnect();
    const term = await upsertUiTermDoc(payload);
    return NextResponse.json({ term });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save UI hint';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const key = new URL(request.url).searchParams.get('key');
  if (!key) {
    return NextResponse.json({ error: 'Key is required' }, { status: 400 });
  }

  try {
    await dbConnect();
    const result = await deleteUiTermDoc(key);
    return NextResponse.json({ message: 'Deleted', key: result.key });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete UI hint';
    const status = message.includes('not found') ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
