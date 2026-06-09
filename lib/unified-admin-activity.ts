/** Client-safe types and constants for unified admin audit (no Mongoose). */

import {
  ADMIN_AUDIT_CATEGORY,
  ADMIN_AUDIT_CATEGORY_LABELS,
} from '@/lib/admin-audit.constants';
import { IMPERSONATION_ACTIVITY_CATEGORY_LABELS } from '@/lib/impersonation-activity-labels';

export type UnifiedActivitySource = 'admin_panel' | 'public_circle';

export type UnifiedActivityRow = {
  id: string;
  source: UnifiedActivitySource;
  adminEmail: string;
  adminName: string;
  summary: string;
  category: string;
  categoryLabel: string;
  createdAt: string;
  details: Record<string, unknown> | null;
  actorWasSuperAdmin?: boolean;
  action?: string;
  resourceType?: string | null;
  resourceId?: string | null;
  sessionId?: string;
  impersonatedUserEmail?: string;
  impersonatedUserId?: string;
  companyId?: string;
  activityType?: string;
  method?: string | null;
  path?: string | null;
  statusCode?: number | null;
  metadata?: Record<string, unknown> | null;
  requestBody?: Record<string, unknown> | null;
  query?: Record<string, unknown> | null;
};

export const UNIFIED_SOURCE_LABELS: Record<UnifiedActivitySource, string> = {
  admin_panel: 'Admin panel',
  public_circle: 'Public Circle',
};

export const UNIFIED_SOURCE_OPTIONS = [
  { value: 'all', label: 'All sources' },
  { value: 'admin_panel', label: UNIFIED_SOURCE_LABELS.admin_panel },
  { value: 'public_circle', label: UNIFIED_SOURCE_LABELS.public_circle },
];

export type GroupedTimelineActivityEntry = {
  kind: 'activity';
  id: string;
  createdAt: string;
  row: UnifiedActivityRow;
};

export type GroupedTimelineSessionEntry = {
  kind: 'session';
  id: string;
  sessionId: string;
  createdAt: string;
  loginSummary: string;
  customerEmail: string;
  customerName?: string;
  companyName?: string;
  actionCount: number;
};

export type GroupedTimelineEntry =
  | GroupedTimelineActivityEntry
  | GroupedTimelineSessionEntry;

export function buildUnifiedCategoryOptions(source: string) {
  const options: { value: string; label: string; group: string }[] = [
    { value: 'all', label: 'All categories', group: 'General' },
  ];

  if (source !== 'public_circle') {
    for (const value of Object.values(ADMIN_AUDIT_CATEGORY)) {
      options.push({
        value: `panel:${value}`,
        label: ADMIN_AUDIT_CATEGORY_LABELS[value] ?? value,
        group: 'Admin panel',
      });
    }
  }

  if (source !== 'admin_panel') {
    for (const [value, label] of Object.entries(IMPERSONATION_ACTIVITY_CATEGORY_LABELS)) {
      options.push({
        value: `pc:${value}`,
        label,
        group: 'Public Circle',
      });
    }
  }

  return options;
}
