// Decimal (SI) units with two decimals — matches how MongoDB Compass displays
// sizes (1 MB = 1,000,000 bytes), so admin values line up with Compass exactly.
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'kB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log10(bytes) / 3), units.length - 1);
  const value = bytes / 1000 ** i;
  return `${value.toFixed(2)} ${units[i]}`;
}

// Binary (1024-based) math labeled with decimal unit names — matches how the
// Atlas cluster dashboard renders storage (Atlas computes in GiB/MiB/etc but
// labels the units "GB"/"MB"), so "billed usage" lines up with what admins
// see in Atlas instead of reading ~7% higher.
export function formatBytesAtlasStyle(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** i;
  return `${value.toFixed(2)} ${units[i]}`;
}

export function formatCount(n: number): string {
  return n.toLocaleString();
}

// Abbreviated counts the way Compass shows them: 992, 2.5K, 607K, 1.2M
export function formatCompactCount(n: number): string {
  if (n < 1000) return String(n);
  const units = ['K', 'M', 'B'];
  let unitIdx = -1;
  let value = n;
  while (value >= 1000 && unitIdx < units.length - 1) {
    value /= 1000;
    unitIdx += 1;
  }
  const rendered =
    value >= 100 ? String(Math.round(value)) : String(Math.round(value * 10) / 10);
  return `${rendered}${units[unitIdx]}`;
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
  /** Exact size measured via $bsonSize when the tab loads */
  size: number;
};

export type CompanyStats = {
  field: string;
  totalCompanies: number;
  truncated: boolean;
  rows: CompanyStatsRow[];
};
