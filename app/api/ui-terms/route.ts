import { NextResponse } from 'next/server';
import { getServerSession, toAdminAuditSession } from '@/lib/auth';
import {
  logAdminActivity,
  ADMIN_AUDIT_ACTION,
  ADMIN_AUDIT_CATEGORY,
} from '@/lib/admin-audit';
import dbConnect from '@/lib/db';
import UiTerm from '@/lib/models/UiTerm';
import { validateUiTermKey } from '@/lib/ui-term-constants';
import { deleteUiTermDoc, readAllUiTerms, upsertUiTermDoc } from '@/lib/ui-term-defaults';

function mapDescriptions(
  descriptions: Map<string, string> | Record<string, string> | undefined
): Record<string, string> {
  if (!descriptions) return {};
  if (descriptions instanceof Map) return Object.fromEntries(descriptions);
  return { ...descriptions };
}

function collectUiTermFieldsChanged(
  existing: {
    label?: string;
    feConstant?: string;
    descriptions?: Map<string, string> | Record<string, string>;
  },
  payload: { label?: string; feConstant?: string; descriptions?: Record<string, string> }
): string[] {
  const fields: string[] = [];
  if ((existing.label ?? '').trim() !== (payload.label ?? '').trim()) {
    fields.push('label');
  }
  if ((existing.feConstant ?? '').trim() !== (payload.feConstant ?? '').trim()) {
    fields.push('FE constant');
  }
  const previous = mapDescriptions(existing.descriptions);
  const next = payload.descriptions ?? {};
  const locales = new Set([...Object.keys(previous), ...Object.keys(next)]);
  const changedLocales = [...locales].filter(
    (code) => (previous[code] ?? '').trim() !== (next[code] ?? '').trim()
  );
  if (changedLocales.length) {
    fields.push(
      changedLocales.length === 1
        ? `description (${changedLocales[0]})`
        : `descriptions (${changedLocales.join(', ')})`
    );
  }
  return fields;
}

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
    const normalizedKey = validateUiTermKey(payload.key);
    const existing = await UiTerm.findOne({ key: normalizedKey })
      .select('key label feConstant descriptions')
      .lean();
    const term = await upsertUiTermDoc(payload);
    const isUpdate = Boolean(existing);
    const fieldsChanged = existing
      ? collectUiTermFieldsChanged(existing, payload)
      : [];

    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.UI_TERM_UPSERT,
        category: ADMIN_AUDIT_CATEGORY.CONTEXT_HELP,
        resourceType: 'ui_term',
        resourceId: term?.key ?? normalizedKey,
        details: {
          key: term?.key ?? normalizedKey,
          isUpdate,
          fieldsChanged,
        },
      });
    }
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
    const auditSession = toAdminAuditSession(session);
    if (auditSession) {
      await logAdminActivity(auditSession, {
        action: ADMIN_AUDIT_ACTION.UI_TERM_DELETE,
        category: ADMIN_AUDIT_CATEGORY.CONTEXT_HELP,
        resourceType: 'ui_term',
        resourceId: key,
        details: { key: result.key },
      });
    }
    return NextResponse.json({ message: 'Deleted', key: result.key });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete UI hint';
    const status = message.includes('not found') ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
