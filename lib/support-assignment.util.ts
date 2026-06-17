export type AssignmentHistoryEntry = {
  _id?: string;
  adminId?: string | null;
  adminName?: string;
  assignedByAdminId?: string | null;
  assignedByName?: string;
  previousAdminId?: string | null;
  previousAdminName?: string;
  note?: string;
  anchorMessageId?: string | null;
  anchorMessageAt?: string | Date | null;
  anchorMessagePreview?: string;
  assignedAt: string | Date;
  label: string;
};

type RawAssignmentEntry = {
  _id?: string;
  adminId?: unknown;
  adminName?: string;
  assignedByAdminId?: unknown;
  assignedByName?: string;
  previousAdminId?: unknown;
  previousAdminName?: string;
  note?: string;
  anchorMessageId?: unknown;
  anchorMessageAt?: string | Date | null;
  anchorMessagePreview?: string;
  assignedAt?: string | Date;
};

export function formatAssignmentHistoryForAdmin(
  entries: RawAssignmentEntry[] | undefined,
): AssignmentHistoryEntry[] {
  if (!Array.isArray(entries)) return [];

  return entries
    .map((entry) => {
      const assignee = entry.adminName?.trim() || 'Unknown admin';
      const assigner = entry.assignedByName?.trim() || 'Super admin';
      const previous = entry.previousAdminName?.trim();
      const label = previous
        ? `${assigner} reassigned from ${previous} to ${assignee}`
        : `${assigner} assigned to ${assignee}`;

      return {
        _id: entry._id ? String(entry._id) : undefined,
        adminId: entry.adminId ? String(entry.adminId) : null,
        adminName: entry.adminName || '',
        assignedByAdminId: entry.assignedByAdminId ? String(entry.assignedByAdminId) : null,
        assignedByName: entry.assignedByName || '',
        previousAdminId: entry.previousAdminId ? String(entry.previousAdminId) : null,
        previousAdminName: entry.previousAdminName || '',
        note: entry.note || '',
        anchorMessageId: entry.anchorMessageId ? String(entry.anchorMessageId) : null,
        anchorMessageAt: entry.anchorMessageAt || null,
        anchorMessagePreview: entry.anchorMessagePreview || '',
        assignedAt: entry.assignedAt || new Date().toISOString(),
        label,
      };
    })
    .sort(
      (a, b) => new Date(a.assignedAt).getTime() - new Date(b.assignedAt).getTime(),
    );
}

export function formatAssignmentTimestamp(value: string | Date) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function getAssignmentsForMessage(
  assignments: AssignmentHistoryEntry[],
  messageId: string,
): AssignmentHistoryEntry[] {
  return assignments.filter((entry) => entry.anchorMessageId === messageId);
}
