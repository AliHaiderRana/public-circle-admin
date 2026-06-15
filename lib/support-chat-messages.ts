import type { SupportChatPendingUpload } from '@/lib/support-chat-pending';
import type { SupportChatAttachment } from '@/lib/support-chat-attachment';
import {
  filterGhostSupportChatMessages,
  isGhostImagePlaceholderMessage,
  isImageOnlyMessagePlaceholder,
  messageHasImage,
  sanitizeSupportChatMessage,
} from '@/lib/support-chat.util';

export type AdminChatMessage = {
  _id: string;
  senderType: string;
  senderName?: string;
  senderAdminId?: string;
  message: string;
  createdAt: string;
  visibility?: 'CUSTOMER' | 'INTERNAL';
  attachment?: SupportChatAttachment;
  clientMessageKey?: string;
  pendingUpload?: SupportChatPendingUpload;
  emailSent?: boolean;
  userWasOnline?: boolean;
};

export function mergeChatMessages(
  existing: AdminChatMessage[],
  incoming: AdminChatMessage[],
): AdminChatMessage[] {
  const map = new Map<string, AdminChatMessage>();
  [...existing, ...incoming].forEach((message) => {
    const sanitized = sanitizeSupportChatMessage(message);
    const prior = map.get(sanitized._id);
    if (!prior) {
      map.set(sanitized._id, sanitized);
      return;
    }
    map.set(sanitized._id, {
      ...sanitized,
      clientMessageKey: sanitized.clientMessageKey ?? prior.clientMessageKey,
      pendingUpload: sanitized.pendingUpload ?? prior.pendingUpload,
    });
  });
  return Array.from(map.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export function replacePendingMessage(
  messages: AdminChatMessage[],
  pendingId: string,
  replacement: AdminChatMessage,
): AdminChatMessage[] {
  const idx = messages.findIndex((m) => m._id === pendingId);
  const pending = idx === -1 ? undefined : messages[idx];

  const merged = sanitizeSupportChatMessage({ ...replacement });

  if (pending?.pendingUpload?.previewUrl) {
    merged.pendingUpload = {
      ...pending.pendingUpload,
      progress: 100,
      error: undefined,
    };
  }

  if (pending?.clientMessageKey) {
    merged.clientMessageKey = pending.clientMessageKey;
  } else if (pending?.pendingUpload?.clientKey) {
    merged.clientMessageKey = pending.pendingUpload.clientKey;
  }

  const withoutPendingAndDupes = messages.filter(
    (m) => m._id !== pendingId && m._id !== merged._id,
  );
  return mergeChatMessages(withoutPendingAndDupes, [merged]);
}

export function clearPendingUploadForMessage(
  messages: AdminChatMessage[],
  messageId: string,
): AdminChatMessage[] {
  return messages.map((message) => {
    if (message._id !== messageId || !message.pendingUpload) return message;
    const url = message.pendingUpload.previewUrl;
    if (url?.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
    return { ...message, pendingUpload: undefined };
  });
}

export function dedupeOutgoingImagePairs(
  messages: AdminChatMessage[],
): AdminChatMessage[] {
  const filtered = filterGhostSupportChatMessages(messages);
  const pendingMessages = filtered.filter(
    (msg) => msg._id.startsWith('pending-') && msg.senderType === 'ADMIN',
  );

  if (pendingMessages.length === 0) return filtered;

  const pendingIdsToDrop = new Set<string>();
  const enrichments = new Map<string, Partial<AdminChatMessage>>();

  for (const pending of pendingMessages) {
    const pendingTime = new Date(pending.createdAt).getTime();
    const partner = filtered.find((other) => {
      if (other._id.startsWith('pending-')) return false;
      if (other.senderType !== 'ADMIN') return false;
      if (!other.attachment?.viewUrl && !messageHasImage(other)) return false;
      return Math.abs(new Date(other.createdAt).getTime() - pendingTime) < 15_000;
    });

    if (!partner) continue;

    pendingIdsToDrop.add(pending._id);
    const existing = enrichments.get(partner._id) ?? {};
    const patch: Partial<AdminChatMessage> = { ...existing };

    if (!partner.clientMessageKey) {
      patch.clientMessageKey =
        pending.clientMessageKey ?? pending.pendingUpload?.clientKey ?? patch.clientMessageKey;
    }
    if (pending.pendingUpload && !partner.pendingUpload && !patch.pendingUpload) {
      patch.pendingUpload = pending.pendingUpload;
    }

    if (patch.clientMessageKey || patch.pendingUpload) {
      enrichments.set(partner._id, patch);
    }
  }

  return filtered
    .filter((msg) => !pendingIdsToDrop.has(msg._id))
    .map((msg) => {
      const patch = enrichments.get(msg._id);
      return patch ? { ...msg, ...patch } : msg;
    });
}

function isPendingImageOnlyMatch(
  pending: AdminChatMessage,
  incoming: AdminChatMessage,
): boolean {
  const pendingText = pending.message.trim();
  const incomingText = incoming.message.trim();
  if (pendingText === incomingText) return true;

  const pendingHasImage = messageHasImage(pending);
  if (!pendingHasImage) return false;

  const incomingHasImage = messageHasImage(incoming);
  const incomingIsPlaceholder = isImageOnlyMessagePlaceholder(incomingText);

  if (incomingHasImage && (incomingIsPlaceholder || incomingText === '')) {
    return true;
  }

  if (incomingText !== '' && !incomingIsPlaceholder) return false;

  return incomingHasImage;
}

export function stripMatchingPendingAdminMessages(
  messages: AdminChatMessage[],
  incoming: AdminChatMessage,
): AdminChatMessage[] {
  if (incoming.senderType !== 'ADMIN') return messages;
  return messages.filter(
    (m) =>
      !(
        m._id.startsWith('pending-') &&
        m.senderType === 'ADMIN' &&
        isPendingImageOnlyMatch(m, incoming)
      ),
  );
}

export function applyIncomingAdminChatMessage(
  messages: AdminChatMessage[],
  incoming: AdminChatMessage,
): AdminChatMessage[] {
  const sanitized = sanitizeSupportChatMessage(incoming);
  if (isGhostImagePlaceholderMessage(sanitized)) {
    return messages;
  }

  if (sanitized.senderType !== 'ADMIN') {
    return mergeChatMessages(messages, [sanitized]);
  }

  const pending = messages.find(
    (m) => m._id.startsWith('pending-') && m.senderType === 'ADMIN' && messageHasImage(m),
  );

  if (pending) {
    return replacePendingMessage(messages, pending._id, sanitized);
  }

  return mergeChatMessages(stripMatchingPendingAdminMessages(messages, sanitized), [sanitized]);
}

export function prepareSupportChatMessagesForDisplay(
  messages: AdminChatMessage[],
): AdminChatMessage[] {
  return dedupeOutgoingImagePairs(messages);
}
