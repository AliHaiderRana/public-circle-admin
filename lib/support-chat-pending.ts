export type SupportChatPendingUpload = {
  previewUrl: string;
  progress: number;
  error?: string;
};

export function createPendingUploadState(file: File): SupportChatPendingUpload {
  return {
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

export function shouldShowChatMessageText(message?: string): boolean {
  const trimmed = (message || '').trim();
  if (!trimmed) return false;
  if (trimmed === '[Image]') return false;
  return true;
}

export function createOptimisticAdminChatMessage(
  message: string,
  options: {
    senderName: string;
    senderAdminId?: string;
    visibility?: 'CUSTOMER' | 'INTERNAL';
    pendingUpload?: SupportChatPendingUpload;
  },
) {
  return {
    _id: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    senderType: 'ADMIN',
    senderName: options.senderName,
    senderAdminId: options.senderAdminId,
    message,
    createdAt: new Date().toISOString(),
    visibility: options.visibility ?? 'CUSTOMER',
    pendingUpload: options.pendingUpload,
  };
}
