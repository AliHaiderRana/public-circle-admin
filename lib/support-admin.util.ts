/** Matches server formatRequestId: SR-{last 8 hex chars of ObjectId}. */
export function formatSupportReferenceId(id: string) {
  const str = String(id);
  return `SR-${str.slice(-8).toUpperCase()}`;
}

/** Parse user search input into an ObjectId suffix for ticket lookup. */
export function parseTicketIdSearchSuffix(search: string): string | null {
  const trimmed = search.trim().replace(/^#/, '');
  if (!trimmed) return null;

  const prefixed = trimmed.match(/^SR-?\s*([A-Fa-f0-9]+)$/i);
  if (prefixed) {
    return prefixed[1].slice(-8).toLowerCase();
  }

  const embedded = trimmed.match(/SR-?\s*([A-Fa-f0-9]{4,})/i);
  if (embedded) {
    return embedded[1].slice(-8).toLowerCase();
  }

  if (/^[A-Fa-f0-9]{4,}$/i.test(trimmed)) {
    return trimmed.slice(-8).toLowerCase();
  }

  return null;
}

/** Prefer a clean admin display name over raw profile/email values. */
export function formatAdminDisplayName(name?: string | null, email?: string | null) {
  const trimmedName = String(name || '').trim();
  const trimmedEmail = String(email || '').trim();

  if (trimmedName) {
    const lower = trimmedName.toLowerCase();
    const emailLocal = trimmedEmail.split('@')[0]?.toLowerCase() || '';

    // "Waqas yopmail" when email is waqas@yopmail.com → "Waqas"
    if (emailLocal && lower === `${emailLocal} yopmail`) {
      return capitalize(emailLocal);
    }

    // Avoid showing strings that look like email addresses
    if (!trimmedName.includes('@')) {
      return trimmedName;
    }
  }

  if (trimmedEmail) {
    const local = trimmedEmail.split('@')[0] || '';
    if (local) return capitalize(local.replace(/[._-]+/g, ' ').trim().split(/\s+/)[0] || local);
  }

  return 'Support';
}

function capitalize(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function getAdminMessageLabel(
  senderName: string | undefined,
  senderAdminId: string | undefined,
  currentAdminId?: string,
  currentAdminName?: string,
) {
  if (senderAdminId && currentAdminId && senderAdminId === currentAdminId) {
    return currentAdminName?.trim() || 'You';
  }
  return senderName?.trim() || 'Support';
}
