import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import dbConnect from '@/lib/db';
import { requireSuperAdminSession } from '@/lib/auth';
import { isSystemDatabase, resolveDb } from '@/lib/db-analytics.server';

const QUERY_TIMEOUT_MS = 15_000;
const MAX_LIMIT = 50;

// Operators that execute code or are otherwise unsafe in an admin query box
const FORBIDDEN_OPERATORS = new Set(['$where', '$function', '$accumulator']);

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

function assertPlainObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
}

/**
 * Recursively validates and revives a user-supplied filter:
 * - rejects code-executing operators
 * - converts {"$oid": "..."} to ObjectId and {"$date": "..."} to Date
 * - rewrites top-level string equality on 24-hex values to match both the
 *   string form and the ObjectId form (fields differ across collections)
 */
function reviveFilter(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reviveFilter);
  if (!value || typeof value !== 'object') return value;

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);

  if (keys.length === 1 && keys[0] === '$oid' && typeof obj.$oid === 'string') {
    if (!OBJECT_ID_RE.test(obj.$oid)) throw new Error(`Invalid $oid value: ${obj.$oid}`);
    return new ObjectId(obj.$oid);
  }
  if (keys.length === 1 && keys[0] === '$date' && typeof obj.$date === 'string') {
    const d = new Date(obj.$date);
    if (Number.isNaN(d.getTime())) throw new Error(`Invalid $date value: ${obj.$date}`);
    return d;
  }

  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (FORBIDDEN_OPERATORS.has(key)) {
      throw new Error(`Operator ${key} is not allowed`);
    }
    const raw = obj[key];
    if (!key.startsWith('$') && typeof raw === 'string' && OBJECT_ID_RE.test(raw)) {
      // Field equality on an id-like string: match both representations
      out[key] = { $in: [raw, new ObjectId(raw)] };
    } else {
      out[key] = reviveFilter(raw);
    }
  }
  return out;
}

function parseSort(raw: string | null): Record<string, 1 | -1> {
  if (!raw?.trim()) return { _id: -1 };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('sort must be valid JSON');
  }
  assertPlainObject(parsed, 'sort');
  const sort: Record<string, 1 | -1> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (value !== 1 && value !== -1) {
      throw new Error(`sort values must be 1 or -1 (got ${JSON.stringify(value)} for "${key}")`);
    }
    sort[key] = value;
  }
  if (Object.keys(sort).length === 0) return { _id: -1 };
  return sort;
}

export async function GET(request: Request) {
  const { error } = await requireSuperAdminSession();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const name = (searchParams.get('name') || '').trim();
    const databaseName = (searchParams.get('database') || '').trim();
    if (!name) {
      return NextResponse.json({ error: 'name query param is required' }, { status: 400 });
    }
    if (databaseName && isSystemDatabase(databaseName)) {
      return NextResponse.json({ error: 'That database is not available here' }, { status: 400 });
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20)
    );

    let filter: Record<string, unknown> = {};
    const rawFilter = searchParams.get('filter');
    if (rawFilter?.trim()) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawFilter);
      } catch {
        return NextResponse.json({ error: 'filter must be valid JSON' }, { status: 400 });
      }
      try {
        assertPlainObject(parsed, 'filter');
        filter = reviveFilter(parsed) as Record<string, unknown>;
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : 'Invalid filter' },
          { status: 400 }
        );
      }
    }

    let sort: Record<string, 1 | -1>;
    try {
      sort = parseSort(searchParams.get('sort'));
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Invalid sort' },
        { status: 400 }
      );
    }

    await dbConnect();
    const db = resolveDb(databaseName || undefined);

    const existing = await db.listCollections({}, { nameOnly: true }).toArray();
    if (!existing.some((c) => c.name === name && c.type !== 'view')) {
      return NextResponse.json({ error: 'Unknown collection' }, { status: 404 });
    }

    const coll = db.collection(name);
    const hasFilter = Object.keys(filter).length > 0;

    // $bsonSize runs only on the page of documents already being fetched for
    // display, so exact per-document sizes come at no extra scan cost.
    const [total, documents] = await Promise.all([
      hasFilter
        ? coll.countDocuments(filter, { maxTimeMS: QUERY_TIMEOUT_MS })
        : coll.estimatedDocumentCount(),
      coll
        .aggregate(
          [
            { $match: filter },
            { $sort: sort },
            { $skip: (page - 1) * limit },
            { $limit: limit },
            { $set: { __sizeBytes: { $bsonSize: '$$ROOT' } } },
          ],
          { allowDiskUse: true, maxTimeMS: QUERY_TIMEOUT_MS }
        )
        .toArray(),
    ]);

    return NextResponse.json({
      documents,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      limit,
    });
  } catch (err) {
    console.error('[db-analytics/collection/documents]', err);
    const message =
      err instanceof Error && /maxTimeMS|operation exceeded/i.test(err.message)
        ? 'Query timed out (15s limit) — narrow the filter'
        : 'Failed to run query';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
