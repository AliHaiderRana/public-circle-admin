import { SUPPORT_REQUEST_STATUS } from '@/lib/constants';
import type { AssignmentHistoryEntry } from '@/lib/support-assignment.util';

const SUPPORT_STATUS_ACTOR = {
  USER: 'USER',
  ADMIN: 'ADMIN',
  SYSTEM: 'SYSTEM',
} as const;

export type StatusHistoryEntry = {
  _id?: string;
  fromStatus?: string | null;
  toStatus: string;
  actorType: string;
  actorId?: string | null;
  actorName?: string;
  note?: string;
  changedAt: string | Date;
};

export type StatusTimelineEntry = StatusHistoryEntry & {
  label: string;
  statusLabel: string;
};

export type TicketHistoryEntry =
  | (StatusTimelineEntry & { kind: 'status' })
  | {
      kind: 'assignment';
      _id?: string;
      label: string;
      changedAt: string;
      note?: string;
      anchorMessagePreview?: string;
    }
  | {
      kind: 'audit';
      _id?: string;
      label: string;
      changedAt: string;
      actorName?: string;
      actorIsPartner?: boolean;
      referralRole?: string | null;
    };

export type SupportAuditTrailEntry = {
  id: string;
  summary: string;
  adminEmail: string;
  adminName: string;
  actorIsPartner?: boolean;
  referralRole?: string | null;
  createdAt: string;
};

type TicketForTimeline = {
  statusHistory?: StatusHistoryEntry[];
  createdAt?: string | Date;
};

function formatStatusLabel(status: string) {
  const labels: Record<string, string> = {
    [SUPPORT_REQUEST_STATUS.OPEN]: 'Open',
    [SUPPORT_REQUEST_STATUS.IN_PROGRESS]: 'In progress',
    [SUPPORT_REQUEST_STATUS.PENDING_RESOLUTION]: 'Awaiting customer confirmation',
    [SUPPORT_REQUEST_STATUS.RESOLVED]: 'Resolved',
    [SUPPORT_REQUEST_STATUS.CLOSED]: 'Closed',
  };
  return labels[status] || String(status || '').replace(/_/g, ' ');
}

function getTimelineLabel(entry: StatusHistoryEntry) {
  const { fromStatus, toStatus, actorType, note, actorName } = entry;
  const actor = actorName?.trim();

  if (toStatus === SUPPORT_REQUEST_STATUS.OPEN && !fromStatus) {
    return actor ? `Ticket created by ${actor}` : 'Ticket created';
  }

  if (
    toStatus === SUPPORT_REQUEST_STATUS.OPEN &&
    fromStatus === SUPPORT_REQUEST_STATUS.PENDING_RESOLUTION &&
    actorType === SUPPORT_STATUS_ACTOR.USER
  ) {
    return note ? `Reopened by customer — ${note}` : 'Reopened by customer';
  }

  if (
    toStatus === SUPPORT_REQUEST_STATUS.PENDING_RESOLUTION &&
    actorType === SUPPORT_STATUS_ACTOR.ADMIN
  ) {
    return actor
      ? `${actor} sent ticket for customer confirmation`
      : 'Sent to customer for resolution confirmation';
  }

  if (toStatus === SUPPORT_REQUEST_STATUS.RESOLVED && actorType === SUPPORT_STATUS_ACTOR.USER) {
    return actor ? `${actor} confirmed the ticket is resolved` : 'Customer confirmed resolved';
  }

  if (toStatus === SUPPORT_REQUEST_STATUS.RESOLVED && actorType === SUPPORT_STATUS_ACTOR.SYSTEM) {
    return note || 'Auto-resolved after 7 days without customer response';
  }

  if (toStatus === SUPPORT_REQUEST_STATUS.IN_PROGRESS && actorType === SUPPORT_STATUS_ACTOR.ADMIN) {
    if (fromStatus === SUPPORT_REQUEST_STATUS.PENDING_RESOLUTION) {
      return actor ? `${actor} reopened the ticket` : 'Reopened by admin';
    }
    if (fromStatus === SUPPORT_REQUEST_STATUS.OPEN) {
      return actor ? `${actor} started working on the ticket` : 'Admin started working on the ticket';
    }
    return actor ? `${actor} marked ticket in progress` : 'Marked in progress';
  }

  if (toStatus === SUPPORT_REQUEST_STATUS.CLOSED) {
    return actor ? `${actor} closed the ticket` : 'Ticket closed';
  }

  const fromLabel = fromStatus ? formatStatusLabel(fromStatus) : 'New';
  const toLabel = formatStatusLabel(toStatus);
  return `${fromLabel} → ${toLabel}`;
}

export function buildStatusTimelineForAdmin(ticket: TicketForTimeline): StatusTimelineEntry[] {
  const entries = Array.isArray(ticket.statusHistory) ? [...ticket.statusHistory] : [];

  if (entries.length === 0 && ticket.createdAt) {
    entries.push({
      fromStatus: null,
      toStatus: SUPPORT_REQUEST_STATUS.OPEN,
      actorType: SUPPORT_STATUS_ACTOR.USER,
      actorName: '',
      note: 'Ticket created',
      changedAt: ticket.createdAt,
    });
  }

  return entries
    .sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime())
    .map((entry) => ({
      ...entry,
      changedAt:
        entry.changedAt instanceof Date ? entry.changedAt.toISOString() : String(entry.changedAt),
      label: getTimelineLabel(entry),
      statusLabel: formatStatusLabel(entry.toStatus),
    }));
}

export function buildTicketHistoryForAdmin(
  statusTimeline: StatusTimelineEntry[],
  assignmentHistory: AssignmentHistoryEntry[] = [],
  auditTrail: SupportAuditTrailEntry[] = [],
): TicketHistoryEntry[] {
  const statusItems: TicketHistoryEntry[] = statusTimeline.map((entry) => ({
    ...entry,
    kind: 'status',
  }));

  const assignmentItems: TicketHistoryEntry[] = assignmentHistory.map((entry) => ({
    kind: 'assignment',
    _id: entry._id,
    label: entry.label,
    changedAt:
      entry.assignedAt instanceof Date
        ? entry.assignedAt.toISOString()
        : String(entry.assignedAt),
    note: entry.note,
    anchorMessagePreview: entry.anchorMessagePreview,
  }));

  const auditItems: TicketHistoryEntry[] = auditTrail.map((entry) => ({
    kind: 'audit',
    _id: entry.id,
    label: entry.summary,
    changedAt: entry.createdAt,
    actorName: entry.adminName?.trim() || entry.adminEmail,
    actorIsPartner: entry.actorIsPartner,
    referralRole: entry.referralRole,
  }));

  return [...statusItems, ...assignmentItems, ...auditItems].sort(
    (a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime(),
  );
}

export function formatTimelineTimestamp(value: string | Date) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
