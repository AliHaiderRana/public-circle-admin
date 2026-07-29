import mongoose from 'mongoose';
import { ADMIN_NOTIFICATION_TYPES } from '@/lib/constants';
import {
  isPartnerSession,
  type AdminSessionLike,
} from '@/lib/partner-access.util';

function assignedAdminIdClauses(assigneeId: string): Record<string, unknown>[] {
  const clauses: Record<string, unknown>[] = [{ 'metadata.assignedAdminId': assigneeId }];
  if (mongoose.isValidObjectId(assigneeId)) {
    clauses.push({
      'metadata.assignedAdminId': new mongoose.Types.ObjectId(assigneeId),
    });
  }
  return clauses;
}

/** Partners only see notifications explicitly addressed to them. */
function partnerNotificationFilter(session: AdminSessionLike): Record<string, unknown> {
  const partnerId = session.referralUserId || session.userId;
  if (!partnerId) {
    return { 'metadata.assignedAdminId': '__none__' };
  }
  const clauses = assignedAdminIdClauses(partnerId);
  return clauses.length > 1 ? { $or: clauses } : clauses[0];
}

/** Regular admins: their assigned tickets + unassigned new tickets. */
function regularAdminNotificationFilter(userId: string): Record<string, unknown> {
  const clauses: Record<string, unknown>[] = [...assignedAdminIdClauses(userId)];
  clauses.push({
    type: ADMIN_NOTIFICATION_TYPES.SUPPORT_REQUEST_CREATED,
    $or: [
      { 'metadata.assignedAdminId': null },
      { 'metadata.assignedAdminId': { $exists: false } },
    ],
  });
  return { $or: clauses };
}

/** Super admins: hide chat alerts delegated to referral partners. */
function superAdminNotificationFilter(): Record<string, unknown> {
  return {
    $or: [
      { type: { $ne: ADMIN_NOTIFICATION_TYPES.SUPPORT_CHAT_CUSTOMER_MESSAGE } },
      { 'metadata.assigneeType': { $ne: 'PARTNER' } },
      { 'metadata.assigneeType': null },
      { 'metadata.assigneeType': { $exists: false } },
    ],
  };
}

/** Scope admin notification queries to what this session should see. */
export function notificationFilterForSession(
  session: AdminSessionLike,
): Record<string, unknown> | null {
  if (isPartnerSession(session)) {
    return partnerNotificationFilter(session);
  }
  if (session.isSuperAdmin) {
    return superAdminNotificationFilter();
  }
  if (session.userId) {
    return regularAdminNotificationFilter(String(session.userId));
  }
  return null;
}

type NotificationLike = {
  type?: string;
  metadata?: {
    assignedAdminId?: unknown;
    assigneeType?: unknown;
  };
};

/** Check whether a single notification document is visible to this session. */
export function notificationAccessibleBySession(
  session: AdminSessionLike,
  notification: NotificationLike,
): boolean {
  const metadata = notification.metadata ?? {};
  const assignedAdminId = metadata.assignedAdminId
    ? String(metadata.assignedAdminId)
    : null;
  const assigneeType = metadata.assigneeType ? String(metadata.assigneeType) : null;

  if (isPartnerSession(session)) {
    const partnerId = session.referralUserId || session.userId;
    return Boolean(partnerId && assignedAdminId === String(partnerId));
  }

  if (session.isSuperAdmin) {
    if (
      notification.type === ADMIN_NOTIFICATION_TYPES.SUPPORT_CHAT_CUSTOMER_MESSAGE &&
      assigneeType === 'PARTNER'
    ) {
      return false;
    }
    return true;
  }

  if (session.userId) {
    const userId = String(session.userId);
    if (assignedAdminId === userId) return true;
    if (
      notification.type === ADMIN_NOTIFICATION_TYPES.SUPPORT_REQUEST_CREATED &&
      !assignedAdminId
    ) {
      return true;
    }
    return false;
  }

  return false;
}

