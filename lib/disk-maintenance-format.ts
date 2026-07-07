export const SERVER_DISK_MAINTENANCE_CRON = "serverDiskMaintenance";

export type DiskMaintenanceAction = {
  name: string;
  freedKb: number;
  freedHuman: string;
  beforeKb?: number;
  beforeHuman?: string;
};

export type DiskMaintenanceMetadata = {
  hostname?: string;
  deployEnv?: string;
  triggeredBy?: string;
  completedAt?: string;
  diskUsePercentBefore?: number;
  diskUsePercentAfter?: number;
  freeKbBefore?: number;
  freeKbAfter?: number;
  freeHumanBefore?: string;
  freeHumanAfter?: string;
  reclaimedKb?: number;
  reclaimedHuman?: string;
  warning?: string | null;
  actions?: DiskMaintenanceAction[];
  pathsAfter?: Array<{ path: string; sizeKb: number; sizeHuman: string }>;
  pm2Logrotate?: {
    configured?: boolean;
    maxSize?: string;
    retain?: number;
    compress?: boolean;
    rotateInterval?: string;
    logsBeforeKb?: number;
    logsAfterKb?: number;
    logsFreedKb?: number;
  };
  reportFile?: string;
  logFile?: string;
  error?: string;
};

export function isDiskMaintenanceCron(cronName: string) {
  return cronName === SERVER_DISK_MAINTENANCE_CRON;
}

export function formatReclaimedKb(kb?: number | null) {
  if (!kb || kb <= 0) return "0K";
  if (kb >= 1048576) return `${(kb / 1048576).toFixed(1)}G`;
  if (kb >= 1024) return `${Math.round(kb / 1024)}M`;
  return `${kb}K`;
}

export function getDiskMaintenanceSummary(metadata: DiskMaintenanceMetadata | null | undefined) {
  if (!metadata) return null;
  return {
    reclaimed: metadata.reclaimedHuman || formatReclaimedKb(metadata.reclaimedKb),
    diskBefore: metadata.diskUsePercentBefore,
    diskAfter: metadata.diskUsePercentAfter,
    freeBefore: metadata.freeHumanBefore,
    freeAfter: metadata.freeHumanAfter,
    triggeredBy: metadata.triggeredBy,
    actionCount: metadata.actions?.length || 0,
  };
}
