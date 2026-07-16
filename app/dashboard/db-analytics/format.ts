export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** i;
  return `${value >= 100 ? Math.round(value) : value.toFixed(value >= 10 ? 1 : 2)} ${units[i]}`;
}

export function formatCount(n: number): string {
  return n.toLocaleString();
}

export type CollectionAnalytics = {
  name: string;
  count: number;
  size: number;
  avgObjSize: number;
  storageSize: number;
  freeStorageSize: number;
  totalIndexSize: number;
  nindexes: number;
  indexSizes: Record<string, number>;
  capped: boolean;
  error?: string;
};

export type CompanyStatsRow = {
  companyId: string | null;
  companyName: string | null;
  count: number;
  /** Exact size from the last on-demand computation; null until computed */
  size: number | null;
  avgSize: number | null;
};

export type CompanyStats = {
  field: string;
  totalCompanies: number;
  truncated: boolean;
  /** When exact sizes were last computed for this collection; null = never */
  sizesComputedAt: string | null;
  rows: CompanyStatsRow[];
};
