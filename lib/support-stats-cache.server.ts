type CachedStats = {
  data: Record<string, unknown>;
  expiresAt: number;
};

let statsCache: CachedStats | null = null;

export function getSupportStatsCache() {
  return statsCache;
}

export function setSupportStatsCache(cache: CachedStats | null) {
  statsCache = cache;
}

export function invalidateSupportStatsCache() {
  statsCache = null;
}
