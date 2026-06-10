type AdminSession = {
  userId?: string;
  isSuperAdmin?: boolean;
};

type TicketAssignee = {
  assignedAdminId?: unknown;
};

export function canAdminAccessTicket(
  session: AdminSession,
  ticket: TicketAssignee,
): boolean {
  if (session.isSuperAdmin) return true;
  if (!session.userId || !ticket.assignedAdminId) return false;
  return String(ticket.assignedAdminId) === String(session.userId);
}

export function assignedTicketsFilterForAdmin(session: AdminSession): Record<string, unknown> {
  if (session.isSuperAdmin) return {};
  if (!session.userId) return { assignedAdminId: '__none__' };
  return { assignedAdminId: session.userId };
}
