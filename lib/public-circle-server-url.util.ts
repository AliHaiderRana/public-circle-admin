/** Origin for PC server calls when a full impressions URL may be stored. */
export function resolvePublicCircleServerOrigin(stored?: string | null): string {
  const value = String(stored || '').trim().replace(/\/+$/, '');
  if (!value) return '';
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}
