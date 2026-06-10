import mongoose from 'mongoose';

export function normalizeSupportRequestId(value: unknown): string {
  return String(value ?? '').trim();
}

/** Match notifications stored with string or ObjectId supportRequestId in metadata. */
export function unreadSupportRequestNotificationFilter(supportRequestId: string) {
  const normalized = normalizeSupportRequestId(supportRequestId);
  const clauses: Record<string, unknown>[] = [{ 'metadata.supportRequestId': normalized }];

  if (mongoose.Types.ObjectId.isValid(normalized)) {
    clauses.push({ 'metadata.supportRequestId': new mongoose.Types.ObjectId(normalized) });
  }

  return {
    isRead: false,
    $or: clauses,
  };
}

export async function markSupportTicketSeenInAdminDb(supportRequestId: string) {
  const normalized = normalizeSupportRequestId(supportRequestId);
  if (!normalized) return { notificationCount: 0, ticketUpdated: false };

  const dbConnect = (await import('@/lib/db')).default;
  const AdminNotification = (await import('@/lib/models/AdminNotification')).default;
  const SupportRequest = (await import('@/lib/models/SupportRequest')).default;
  const SupportChatThread = (await import('@/lib/models/SupportChatThread')).default;

  await dbConnect();

  const threadFilter =
    mongoose.Types.ObjectId.isValid(normalized)
      ? {
          $or: [
            { supportRequestId: normalized },
            { supportRequestId: new mongoose.Types.ObjectId(normalized) },
          ],
        }
      : { supportRequestId: normalized };

  const [notificationResult, ticketResult] = await Promise.all([
    AdminNotification.updateMany(unreadSupportRequestNotificationFilter(normalized), {
      isRead: true,
      readAt: new Date(),
    }),
    SupportRequest.findByIdAndUpdate(normalized, { unreadByAdmin: 0 }),
    SupportChatThread.updateOne(threadFilter, { unreadByAdmin: 0 }),
  ]);

  return {
    notificationCount: notificationResult.modifiedCount ?? 0,
    ticketUpdated: Boolean(ticketResult),
  };
}
