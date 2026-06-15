export type SupportChatPendingUpload = {
  /** Stable id for React keys across pending → server message transitions. */
  clientKey: string;
  previewUrl: string;
  progress: number;
  error?: string;
};

export function createClientMessageKey(): string {
  return `cmsg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createPendingUploadState(file: File): SupportChatPendingUpload {
  return {
    clientKey: createClientMessageKey(),
    previewUrl: URL.createObjectURL(file),
    progress: 0,
  };
}

export function revokePendingUploadPreview(message?: {
  pendingUpload?: SupportChatPendingUpload | null;
}) {
  const url = message?.pendingUpload?.previewUrl;
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

export function patchPendingMessageUpload<
  T extends { _id: string; pendingUpload?: SupportChatPendingUpload },
>(messages: T[], pendingId: string, patch: Partial<SupportChatPendingUpload>): T[] {
  return messages.map((message) =>
    message._id === pendingId && message.pendingUpload
      ? { ...message, pendingUpload: { ...message.pendingUpload, ...patch } }
      : message,
  );
}

export { shouldShowChatMessageText } from '@/lib/support-chat.util';

export function createOptimisticAdminChatMessage(
  message: string,
  options: {
    senderName: string;
    senderAdminId?: string;
    visibility?: 'CUSTOMER' | 'INTERNAL';
    pendingUpload?: SupportChatPendingUpload;
  },
) {
  const clientMessageKey =
    options.pendingUpload?.clientKey ??
    `cmsg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return {
    _id: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    senderType: 'ADMIN',
    senderName: options.senderName,
    senderAdminId: options.senderAdminId,
    message,
    createdAt: new Date().toISOString(),
    visibility: options.visibility ?? 'CUSTOMER',
    clientMessageKey,
    pendingUpload: options.pendingUpload,
  };
}
