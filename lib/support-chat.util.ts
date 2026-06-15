import type { SupportChatPendingUpload } from '@/lib/support-chat-pending';
import type { SupportChatAttachment } from '@/lib/support-chat-attachment';

const IMAGE_ONLY_MESSAGE_PLACEHOLDERS = new Set(['[Image]', '.', '·', '•']);

export type SupportChatMessageLike = {
  _id: string;
  senderType?: string;
  message?: string;
  clientMessageKey?: string;
  pendingUpload?: SupportChatPendingUpload | null;
  attachment?: SupportChatAttachment | null;
};

type MessageWithImage = {
  message?: string;
  pendingUpload?: { previewUrl?: string; clientKey?: string } | null;
  attachment?: {
    viewUrl?: string;
    s3Path?: string;
    contentType?: string;
    originalName?: string;
  } | null;
};

export function mergeSupportChatAttachments<
  T extends { viewUrl?: string; s3Path?: string } | null | undefined,
>(next: T, prev: T): T {
  if (!next && !prev) return next;
  if (!next) return prev;
  if (!prev) return next;

  const nextPath = resolveAttachmentObjectKey(next);
  const prevPath = resolveAttachmentObjectKey(prev);
  const sameObject = Boolean(nextPath && prevPath && nextPath === prevPath);

  return {
    ...prev,
    ...next,
    viewUrl: sameObject ? (prev.viewUrl ?? next.viewUrl) : (next.viewUrl ?? prev.viewUrl),
    s3Path: next.s3Path ?? prev.s3Path,
  } as T;
}

/** Stable identity for the same S3 object across refreshed presigned query strings. */
export function resolveAttachmentObjectKey(attachment?: {
  viewUrl?: string;
  s3Path?: string;
} | null): string | undefined {
  const s3Path = attachment?.s3Path?.trim();
  if (s3Path) return s3Path;

  const viewUrl = attachment?.viewUrl?.trim();
  if (!viewUrl) return undefined;

  try {
    return decodeURIComponent(new URL(viewUrl).pathname);
  } catch {
    return viewUrl.split('?')[0];
  }
}

export function getChatImageStableKey(
  attachment?: { viewUrl?: string; s3Path?: string } | null,
  pendingPreviewUrl?: string,
): string | undefined {
  const objectKey = resolveAttachmentObjectKey(attachment);
  if (objectKey) return objectKey;
  if (pendingPreviewUrl?.startsWith('blob:')) return pendingPreviewUrl;
  return attachment?.viewUrl || pendingPreviewUrl || undefined;
}

const loadedChatImageKeys = new Set<string>();

export function isChatImageLoaded(stableKey?: string): boolean {
  return Boolean(stableKey && loadedChatImageKeys.has(stableKey));
}

export function markChatImageLoaded(stableKey?: string): void {
  if (stableKey) loadedChatImageKeys.add(stableKey);
}

export function getSupportChatMessageKey(message: {
  _id: string;
  clientMessageKey?: string;
  pendingUpload?: { clientKey?: string } | null;
}): string {
  return message.clientMessageKey || message.pendingUpload?.clientKey || message._id;
}

export function messageHasImage(message: MessageWithImage): boolean {
  return Boolean(
    message.pendingUpload?.previewUrl ||
      message.attachment?.viewUrl ||
      message.attachment?.s3Path ||
      (message.attachment?.contentType?.startsWith('image/') &&
        message.attachment?.originalName),
  );
}

export function getChatImageSrc(message: MessageWithImage): string | undefined {
  return message.attachment?.viewUrl || message.pendingUpload?.previewUrl || undefined;
}

export function isImageOnlyMessagePlaceholder(message?: string): boolean {
  const trimmed = (message || '').trim();
  return !trimmed || IMAGE_ONLY_MESSAGE_PLACEHOLDERS.has(trimmed);
}

export function shouldShowChatMessageText(
  message?: string,
  options?: { hasImage?: boolean },
): boolean {
  if (options?.hasImage) return false;
  const trimmed = (message || '').trim();
  if (!trimmed) return false;
  if (IMAGE_ONLY_MESSAGE_PLACEHOLDERS.has(trimmed)) return false;
  return true;
}

export function messageHasDisplayableContent(message: MessageWithImage): boolean {
  if (messageHasImage(message)) return true;
  return shouldShowChatMessageText(message.message);
}

export function sanitizeSupportChatMessage<T extends SupportChatMessageLike>(message: T): T {
  if (!isImageOnlyMessagePlaceholder(message.message)) {
    return message;
  }
  return { ...message, message: '' };
}

export function isGhostImagePlaceholderMessage(
  message: MessageWithImage & { _id?: string },
): boolean {
  if (message._id?.startsWith('pending-')) return false;
  if (getChatImageSrc(message)) return false;
  if (message.attachment?.s3Path) return false;
  if (
    message.attachment?.contentType?.startsWith('image/') &&
    message.attachment?.originalName
  ) {
    return false;
  }
  return isImageOnlyMessagePlaceholder(message.message);
}

export function formatSupportChatPreview(preview?: string): string {
  const trimmed = (preview || '').trim();
  if (!trimmed || isImageOnlyMessagePlaceholder(trimmed)) {
    return trimmed === '[Image]' ? 'Photo' : '';
  }
  return trimmed;
}

export function getChatMessageInboxPreview(message: {
  message?: string;
  attachment?: {
    viewUrl?: string;
    s3Path?: string;
    contentType?: string;
    originalName?: string;
  } | null;
}): string {
  const hasImage = Boolean(message.attachment?.viewUrl || message.attachment?.s3Path);
  const formatted = formatSupportChatPreview(message.message);
  if (formatted) return formatted.slice(0, 200);
  if (hasImage) return 'Photo';
  return (message.message || '').trim().slice(0, 200);
}

export function filterGhostSupportChatMessages<T extends SupportChatMessageLike>(
  messages: T[],
): T[] {
  return messages
    .map(sanitizeSupportChatMessage)
    .filter((msg) => !isGhostImagePlaceholderMessage(msg));
}
