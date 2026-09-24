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

const IMPRESSIONS_PATH = '/internal/referral/impressions';

/** Fixed impressions POST URL for this Admin environment (origin from AppConfig). */
export function buildImpressionsEndpointUrl(originOrUrl?: string | null): string {
  const origin = resolvePublicCircleServerOrigin(originOrUrl);
  if (!origin) return '';
  return `${origin}${IMPRESSIONS_PATH}`;
}
