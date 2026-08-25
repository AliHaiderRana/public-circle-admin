import type { FeedbackItem } from '@/lib/feedback.types';

function toIso(value: unknown): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function entityId(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string' || typeof value === 'number') {
    const id = String(value).trim();
    return id || undefined;
  }
  if (typeof value === 'object' && 'toString' in value) {
    const id = String((value as { toString(): string }).toString()).trim();
    if (id && id !== '[object Object]') return id;
  }
  return undefined;
}

export function serializeFeedback(item: Record<string, unknown> | null | undefined): FeedbackItem | null {
  if (!item) return null;

  const company = item.companyId as
    | (FeedbackItem['companyId'] & { id?: unknown })
    | string
    | null
    | undefined;
  const user = item.userId as
    | (FeedbackItem['userId'] & { id?: unknown })
    | string
    | null
    | undefined;
  const metadata = item.metadata;

  return {
    _id: String(item._id),
    type: String(item.type || ''),
    message: String(item.message || ''),
    rating: typeof item.rating === 'number' ? item.rating : null,
    pagePath: typeof item.pagePath === 'string' ? item.pagePath : '',
    status: String(item.status || ''),
    adminNotes: typeof item.adminNotes === 'string' ? item.adminNotes : '',
    metadata:
      metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : {},
    createdAt: toIso(item.createdAt),
    updatedAt: toIso(item.updatedAt),
    companyId:
      company && typeof company === 'object'
        ? {
            _id: entityId(company._id) ?? entityId((company as { id?: unknown }).id),
            name: company.name,
          }
        : typeof company === 'string'
          ? { _id: company }
          : null,
    userId:
      user && typeof user === 'object'
        ? {
            _id: entityId(user._id) ?? entityId((user as { id?: unknown }).id),
            firstName: user.firstName,
            lastName: user.lastName,
            emailAddress: user.emailAddress,
          }
        : typeof user === 'string'
          ? { _id: user }
          : null,
  };
}
