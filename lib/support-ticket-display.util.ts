import { SUPPORT_REQUEST_CATEGORY_LABELS } from '@/lib/constants';

export type SupportTicketPreviewFields = {
  lastMessagePreview?: string;
  message?: string;
  subject?: string;
  category?: string;
};

const SYSTEM_MESSAGE_RE = /^\[(Ticket reopened|Ticket resolved|System)\]/i;

function normalizePreviewText(text: string): string {
  return text
    .replace(SYSTEM_MESSAGE_RE, '')
    .replace(/\[Image\]/gi, '')
    .replace(/^[.·•]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncatePreview(text: string, maxLength = 120): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

export function formatSupportTicketCustomerName(
  companyName?: string | null,
  userName?: string | null,
): string {
  const company = companyName?.trim();
  const user = userName?.trim();
  if (company && user) return `${company} · ${user}`;
  return company || user || 'Support request';
}

export function getSupportTicketSubjectTitle(
  subject?: string | null,
  fallback?: string | null,
): string {
  const normalized = normalizePreviewText(subject || '');
  if (normalized) return truncatePreview(normalized, 80);
  const fallbackText = fallback?.trim();
  return fallbackText || 'Support ticket';
}

/**
 * Secondary inbox/chat line: latest chat or initial message, then customer/category.
 */
export function getSupportTicketPreviewText(
  ticket: SupportTicketPreviewFields,
  options: { excludeSubject?: boolean } = {},
): string {
  const last = normalizePreviewText(ticket.lastMessagePreview || '');
  if (last) return truncatePreview(last);

  const initial = normalizePreviewText(ticket.message || '');
  if (initial) return truncatePreview(initial);

  if (!options.excludeSubject) {
    const subject = normalizePreviewText(ticket.subject || '');
    if (subject) return truncatePreview(subject);
  }

  const category = ticket.category
    ? SUPPORT_REQUEST_CATEGORY_LABELS[ticket.category] ?? ticket.category
    : '';
  return category || 'No messages yet';
}

export function getSupportTicketAvatarInitials(companyName?: string | null): string {
  const name = companyName?.trim() || 'SR';
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
