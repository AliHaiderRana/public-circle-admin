'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { SupportChatSendButton } from '@/components/SupportChatSendButton';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  RefreshCw,
  Lock,
  ImagePlus,
  X,
  Settings2,
  Mail,
  Building2,
  CheckCircle2,
  UserRound,
  Trash2,
  ChevronDown,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  getSupportTicketPreviewText,
  getSupportTicketSubjectTitle,
} from '@/lib/support-ticket-display.util';
import {
  SUPPORT_CHAT_SENDER_TYPE,
  SUPPORT_REQUEST_CATEGORY_LABELS,
  SUPPORT_REQUEST_STATUS,
  SUPPORT_REQUEST_STATUS_LABELS,
} from '@/lib/constants';
import { getSupportMessageSenderLabel } from '@/lib/support-admin.util';
import { formatReferralPartnerRole } from '@/components/support/AssigneeSelectOptions';
import {
  getSupportSocket,
  joinSupportChatRoom,
  leaveSupportChatRoom,
  sendSupportChatMessage,
  subscribeSupportChatMessage,
} from '@/lib/support-socket';
import {
  canMarkAdminSupportTicketRead,
  setActiveAdminSupportTicketId,
} from '@/lib/admin-support-view';
import {
  broadcastAdminSupportTabEvent,
  onAdminSupportTabChatMessage,
} from '@/lib/support-tab-sync';
import { subscribeAdminSupportChatPurged } from '@/lib/admin-notification-socket';
import {
  SUPPORT_CHAT_IMAGE_ACCEPT,
  uploadSupportChatImage,
  validateSupportChatImageFile,
  type SupportChatAttachment,
} from '@/lib/support-chat-attachment';
import { SupportChatMessageContent } from '@/components/SupportChatMessageContent';
import {
  applyIncomingAdminChatMessage,
  clearPendingUploadForMessage,
  mergeChatMessages,
  prepareSupportChatMessagesForDisplay,
  replacePendingMessage,
  type AdminChatMessage,
} from '@/lib/support-chat-messages';
import {
  getChatMessageInboxPreview,
  getSupportChatMessageKey,
  messageHasDisplayableContent,
  messageHasImage,
} from '@/lib/support-chat.util';
import {
  createOptimisticAdminChatMessage,
  createPendingUploadState,
  patchPendingMessageUpload,
  revokePendingUploadPreview,
  shouldShowChatMessageText,
} from '@/lib/support-chat-pending';

const CHAT_PAGE_SIZE = 30;
const CHAT_POLL_MS = 15000;

type ChatMessage = AdminChatMessage;

type AssignableAdmin = {
  id: string;
  name: string;
  email?: string;
  isSuperAdmin?: boolean;
};

type TicketChatPanelProps = {
  requestId: string;
  referenceId?: string;
  subject?: string;
  ticketMessage?: string;
  adminNotes?: string;
  companyId?: string;
  companyName?: string;
  userName?: string;
  currentAdminId?: string;
  currentAdminName?: string;
  assignableAdmins?: AssignableAdmin[];
  className?: string;
  onActivity?: () => void;
  onOpenManage?: () => void;
  onCloseTicket?: () => void;
  onForceResolveTicket?: () => void;
  closingTicket?: boolean;
  isSuperAdmin?: boolean;
  isPartner?: boolean;
  onTicketDeleted?: () => void;
  onTicketLoaded?: (ticket: {
    status?: string;
    message?: string;
    adminNotes?: string;
    subject?: string;
    unreadByAdmin?: number;
    assignedAdminId?: string | null;
    assignedAdminName?: string;
    updatedAt?: string;
    latestMessageId?: string | null;
  }) => void;
  showRefresh?: boolean;
  refreshKey?: number;
};

const READ_ONLY_STATUSES = new Set([
  SUPPORT_REQUEST_STATUS.RESOLVED,
  SUPPORT_REQUEST_STATUS.CLOSED,
]);

function isSystemMessage(message: string) {
  return /^\[(Ticket reopened|Ticket resolved|System)\]/i.test(message.trim());
}

function formatMessageTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case SUPPORT_REQUEST_STATUS.OPEN:
      return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900';
    case SUPPORT_REQUEST_STATUS.IN_PROGRESS:
      return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900';
    case SUPPORT_REQUEST_STATUS.PENDING_RESOLUTION:
      return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900';
    case SUPPORT_REQUEST_STATUS.RESOLVED:
      return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function TicketChatPanel({
  requestId,
  referenceId,
  subject,
  ticketMessage: ticketMessageProp,
  adminNotes: adminNotesProp,
  companyId: companyIdProp,
  companyName,
  userName,
  currentAdminId,
  currentAdminName,
  assignableAdmins = [],
  className,
  onActivity,
  onOpenManage,
  onCloseTicket,
  onForceResolveTicket,
  closingTicket = false,
  isSuperAdmin = false,
  isPartner = false,
  onTicketDeleted,
  onTicketLoaded,
  showRefresh = true,
  refreshKey = 0,
}: TicketChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [reply, setReply] = useState('');
  const [replyInternal, setReplyInternal] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  const [ticketStatus, setTicketStatus] = useState<string | null>(null);
  const [loadedSubject, setLoadedSubject] = useState<string | undefined>();
  const [loadedTicketMessage, setLoadedTicketMessage] = useState<string | undefined>();
  const [loadedAdminNotes, setLoadedAdminNotes] = useState<string | undefined>();
  const [loadedCategory, setLoadedCategory] = useState<string | undefined>();
  const [loadedCreatedAt, setLoadedCreatedAt] = useState<string | undefined>();
  const [loadedCompanyId, setLoadedCompanyId] = useState<string | undefined>();
  const [loadedProjectName, setLoadedProjectName] = useState<string | undefined>();
  const [loadedAssignedAdminName, setLoadedAssignedAdminName] = useState<string | undefined>();
  const socketReadyRef = useRef(false);
  const [userOnline, setUserOnline] = useState<boolean | null>(null);
  const [deliveryNotice, setDeliveryNotice] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [deletingChat, setDeletingChat] = useState(false);
  const [linkedReferralPartners, setLinkedReferralPartners] = useState<
    Array<{
      id: string;
      email: string;
      name: string;
      role: 'SALES_PERSON' | 'MARKETING_AFFILIATE';
    }>
  >([]);
  const [fetchedSenderRoles, setFetchedSenderRoles] = useState<Record<string, string>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesContentRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const previousMessageCountRef = useRef(0);
  const previousOldestIdRef = useRef<string | null>(null);
  const onActivityRef = useRef(onActivity);
  const onTicketLoadedRef = useRef(onTicketLoaded);
  const lastTicketMetaRef = useRef<string>('');
  const markedSeenForTicketRef = useRef<string | null>(null);
  const fetchMessagesRef = useRef<
    (before?: string, opts?: { silent?: boolean }) => Promise<void>
  >(() => Promise.resolve());
  const markTicketSeenRef = useRef<() => void>(() => undefined);
  const activeOutgoingPendingIdRef = useRef<string | null>(null);

  const handleClearPendingUpload = useCallback((messageId: string) => {
    window.setTimeout(() => {
      setMessages((prev) => clearPendingUploadForMessage(prev, messageId));
    }, 400);
  }, []);

  const displayMessages = useMemo(
    () => prepareSupportChatMessagesForDisplay(messages),
    [messages],
  );

  const resolveAdminRole = useCallback(
    (senderAdminId: string) => {
      const admin = assignableAdmins.find((entry) => entry.id === senderAdminId);
      if (admin) {
        return admin.isSuperAdmin ? 'Super admin' : 'Admin';
      }

      const partner = linkedReferralPartners.find((entry) => entry.id === senderAdminId);
      if (partner) {
        return formatReferralPartnerRole(partner.role);
      }

      return fetchedSenderRoles[senderAdminId];
    },
    [assignableAdmins, linkedReferralPartners, fetchedSenderRoles],
  );

  useEffect(() => {
    const missingAdminIds = [
      ...new Set(
        displayMessages
          .filter((message) => {
            if (
              message.senderType !== SUPPORT_CHAT_SENDER_TYPE.ADMIN ||
              !message.senderAdminId ||
              message.senderRoleLabel
            ) {
              return false;
            }

            const senderAdminId = String(message.senderAdminId);
            if (fetchedSenderRoles[senderAdminId]) return false;
            if (assignableAdmins.some((entry) => entry.id === senderAdminId)) return false;
            if (linkedReferralPartners.some((entry) => entry.id === senderAdminId)) {
              return false;
            }
            return true;
          })
          .map((message) => String(message.senderAdminId)),
      ),
    ];

    if (!missingAdminIds.length) return;

    const query = new URLSearchParams({ ids: missingAdminIds.join(',') });
    void fetch(`/api/support/sender-roles?${query.toString()}`)
      .then((res) => (res.ok ? res.json() : { roles: {} }))
      .then((data: { roles?: Record<string, string> }) => {
        const roles = data.roles ?? {};
        if (!Object.keys(roles).length) return;
        setFetchedSenderRoles((prev) => ({ ...prev, ...roles }));
      })
      .catch(() => undefined);
  }, [displayMessages, assignableAdmins, linkedReferralPartners, fetchedSenderRoles]);

  const markTicketSeen = useCallback(() => {
    if (!canMarkAdminSupportTicketRead(requestId)) return;
    if (markedSeenForTicketRef.current === requestId) return;

    markedSeenForTicketRef.current = requestId;
    onTicketLoadedRef.current?.({ unreadByAdmin: 0 });

    void fetch('/api/notifications/mark-read-by-ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supportRequestId: requestId }),
    })
      .then(() => {
        window.dispatchEvent(new Event('admin-notifications:refresh'));
        window.dispatchEvent(new Event('support-stats:refresh'));
      })
      .catch(() => {
        markedSeenForTicketRef.current = null;
      });
  }, [requestId]);

  useEffect(() => {
    markTicketSeenRef.current = markTicketSeen;
  }, [markTicketSeen]);

  useEffect(() => {
    onActivityRef.current = onActivity;
  }, [onActivity]);

  useEffect(() => {
    onTicketLoadedRef.current = onTicketLoaded;
  }, [onTicketLoaded]);

  const scrollToBottom = useCallback(() => {
    const anchor = messagesEndRef.current;
    if (anchor) {
      anchor.scrollIntoView({ block: 'end' });
      return;
    }
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, []);

  const scheduleScrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollToBottom();
      requestAnimationFrame(scrollToBottom);
    });
    window.setTimeout(scrollToBottom, 80);
    window.setTimeout(scrollToBottom, 320);
  }, [scrollToBottom]);

  const scrollToBottomIfNearEnd = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 64;
    if (nearBottom) {
      stickToBottomRef.current = true;
      scheduleScrollToBottom();
    } else {
      stickToBottomRef.current = false;
    }
  }, [scheduleScrollToBottom]);

  useEffect(() => {
    const content = messagesContentRef.current;
    if (!content) return;

    const observer = new ResizeObserver(() => {
      if (stickToBottomRef.current) {
        scrollToBottom();
      }
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [requestId, scrollToBottom]);

  useEffect(() => {
    if (displayMessages.length === 0) return;

    const oldestId = displayMessages[0]?._id ?? null;
    const grewAtBottom =
      displayMessages.length > previousMessageCountRef.current &&
      oldestId === previousOldestIdRef.current;

    previousMessageCountRef.current = displayMessages.length;
    previousOldestIdRef.current = oldestId;

    if (loadingOlder) return;

    if (stickToBottomRef.current || grewAtBottom) {
      scheduleScrollToBottom();
    }
  }, [displayMessages, loadingOlder, scheduleScrollToBottom]);

  useEffect(() => {
    if (loading || displayMessages.length === 0) return;
    if (!stickToBottomRef.current) return;
    scheduleScrollToBottom();
    const delayedA = window.setTimeout(scheduleScrollToBottom, 600);
    const delayedB = window.setTimeout(scheduleScrollToBottom, 1200);
    return () => {
      window.clearTimeout(delayedA);
      window.clearTimeout(delayedB);
    };
  }, [loading, displayMessages.length, requestId, scheduleScrollToBottom]);

  const mergeMessages = useCallback(
    (existing: ChatMessage[], incoming: ChatMessage[]) => mergeChatMessages(existing, incoming),
    [],
  );

  const fetchMessages = useCallback(
    async (before?: string, { silent = false }: { silent?: boolean } = {}) => {
      const isOlderPage = Boolean(before);
      if (isOlderPage) {
        setLoadingOlder(true);
      } else if (!silent) {
        setLoading(true);
      }

      const scrollEl = scrollContainerRef.current;
      const previousScrollHeight = scrollEl?.scrollHeight ?? 0;

      try {
        const params = new URLSearchParams({ limit: String(CHAT_PAGE_SIZE) });
        if (before) params.set('before', before);
        const res = await fetch(`/api/support-requests/${requestId}/messages?${params}`);
        if (!res.ok) return;

        const data = await res.json();
        const incoming = data.messages ?? [];

        if (!isOlderPage && data.ticket?.status) {
          setTicketStatus(data.ticket.status);
        }
        if (!isOlderPage && data.ticket?.subject) {
          setLoadedSubject(data.ticket.subject);
        }
        if (!isOlderPage && data.ticket) {
          setLoadedCategory(
            typeof data.ticket.category === 'string' ? data.ticket.category : undefined,
          );
          setLoadedCreatedAt(
            typeof data.ticket.createdAt === 'string' ? data.ticket.createdAt : undefined,
          );
          if (typeof data.ticket.message === 'string') {
            setLoadedTicketMessage(data.ticket.message);
          }
          if (typeof data.ticket.adminNotes === 'string') {
            setLoadedAdminNotes(data.ticket.adminNotes);
          }
          if (data.ticket.companyId) {
            setLoadedCompanyId(String(data.ticket.companyId));
          }
          if (typeof data.ticket.projectName === 'string' && data.ticket.projectName.trim()) {
            setLoadedProjectName(data.ticket.projectName.trim());
          }
          if (typeof data.ticket.assignedAdminName === 'string') {
            setLoadedAssignedAdminName(data.ticket.assignedAdminName);
          }
          if (typeof data.userOnline === 'boolean') {
            setUserOnline(data.userOnline);
          } else if (typeof data.ticket.userOnline === 'boolean') {
            setUserOnline(data.ticket.userOnline);
          }

          const latestMessageId =
            !isOlderPage && incoming.length > 0 ? incoming[incoming.length - 1]._id : null;
          const metaKey = [
            data.ticket.status ?? '',
            data.ticket.unreadByAdmin ?? '',
            data.ticket.assignedAdminId ?? '',
            data.ticket.updatedAt ?? '',
            latestMessageId ?? '',
          ].join('|');

          if (metaKey !== lastTicketMetaRef.current) {
            lastTicketMetaRef.current = metaKey;
            onTicketLoadedRef.current?.({
              status: data.ticket.status,
              subject: data.ticket.subject,
              message: data.ticket.message,
              adminNotes: data.ticket.adminNotes,
              unreadByAdmin:
                typeof data.ticket.unreadByAdmin === 'number'
                  ? data.ticket.unreadByAdmin
                  : undefined,
              assignedAdminId: data.ticket.assignedAdminId ?? null,
              assignedAdminName: data.ticket.assignedAdminName,
              updatedAt: data.ticket.updatedAt,
              latestMessageId,
            });
          }
        }

        if (isOlderPage) {
          setMessages((prev) => mergeMessages(incoming, prev));
          setHasMoreOlder(data.hasMore ?? false);
          requestAnimationFrame(() => {
            if (!scrollEl) return;
            scrollEl.scrollTop = scrollEl.scrollHeight - previousScrollHeight;
          });
        } else {
          setMessages((prev) => (silent ? mergeMessages(prev, incoming) : incoming));
          setTotalCount(data.totalCount ?? 0);
          if (!silent) {
            setHasMoreOlder(data.hasMore ?? false);
            markTicketSeenRef.current?.();
          }
          if (stickToBottomRef.current) {
            scheduleScrollToBottom();
          }
        }
      } finally {
        if (isOlderPage) setLoadingOlder(false);
        else if (!silent) setLoading(false);
      }
    },
    [mergeMessages, requestId, scheduleScrollToBottom],
  );

  fetchMessagesRef.current = fetchMessages;

  useEffect(() => {
    setActiveAdminSupportTicketId(requestId);
    markedSeenForTicketRef.current = null;
    setMessages([]);
    setHasMoreOlder(false);
    setTotalCount(0);
    setTicketStatus(null);
    setLoadedSubject(undefined);
    setLoadedTicketMessage(undefined);
    setLoadedAdminNotes(undefined);
    setLoadedCategory(undefined);
    setLoadedCreatedAt(undefined);
    setLoadedCompanyId(undefined);
    setLoadedProjectName(undefined);
    setLoadedAssignedAdminName(undefined);
    socketReadyRef.current = false;
    setUserOnline(null);
    setDeliveryNotice(null);
    setDeleteConfirmOpen(false);
    lastTicketMetaRef.current = '';
    stickToBottomRef.current = true;
    previousMessageCountRef.current = 0;
    previousOldestIdRef.current = null;
    setDetailsExpanded(false);
    setFetchedSenderRoles({});
    setLoading(true);

    let cancelled = false;

    const load = (before?: string, silent = false) => {
      if (cancelled) return;
      void fetchMessagesRef.current(before, { silent });
    };

    load();

    const interval = setInterval(() => {
      if (socketReadyRef.current) return;
      load(undefined, true);
    }, CHAT_POLL_MS);

    let unsubscribe: (() => void) | undefined;

    void (async () => {
      const activeSocket = await getSupportSocket();
      if (cancelled || !activeSocket) return;

      unsubscribe = subscribeSupportChatMessage(activeSocket, (payload) => {
        if (payload.supportRequestId !== requestId || !payload.message) return;
        if (
          activeOutgoingPendingIdRef.current &&
          payload.message.senderType === SUPPORT_CHAT_SENDER_TYPE.ADMIN
        ) {
          return;
        }
        setMessages((prev) =>
          applyIncomingAdminChatMessage(prev, payload.message as ChatMessage),
        );
        scrollToBottomIfNearEnd();
        if (payload.message.senderType === SUPPORT_CHAT_SENDER_TYPE.USER) {
          markedSeenForTicketRef.current = null;
          markTicketSeenRef.current?.();
        }
        onActivityRef.current?.();
      });

      const joined = await joinSupportChatRoom(requestId);
      if (cancelled) return;
      socketReadyRef.current = joined;
    })();

    return () => {
      cancelled = true;
      clearInterval(interval);
      unsubscribe?.();
      leaveSupportChatRoom(requestId);
      setActiveAdminSupportTicketId(null);
    };
  }, [requestId, mergeMessages, scrollToBottomIfNearEnd]);

  useEffect(() => {
    if (!loading && requestId) {
      markTicketSeenRef.current?.();
    }
  }, [loading, requestId]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        markTicketSeenRef.current?.();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [requestId]);

  useEffect(() => {
    return onAdminSupportTabChatMessage((payload) => {
      if (payload.supportRequestId !== requestId) return;
      if (
        activeOutgoingPendingIdRef.current &&
        payload.message.senderType === SUPPORT_CHAT_SENDER_TYPE.ADMIN
      ) {
        return;
      }
      setMessages((prev) =>
        applyIncomingAdminChatMessage(prev, payload.message as ChatMessage),
      );
      scrollToBottomIfNearEnd();
      onActivityRef.current?.();
    });
  }, [requestId, mergeMessages, scrollToBottomIfNearEnd]);

  useEffect(() => {
    if (!refreshKey) return;
    void fetchMessagesRef.current(undefined, { silent: true });
  }, [refreshKey]);

  const handleLoadOlder = useCallback(() => {
    const oldest = messages[0];
    if (!oldest || loadingOlder || !hasMoreOlder) return;
    stickToBottomRef.current = false;
    fetchMessages(oldest._id);
  }, [messages, loadingOlder, hasMoreOlder, fetchMessages]);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 64;

    if (el.scrollTop <= 48 && hasMoreOlder && !loadingOlder) {
      handleLoadOlder();
    }
  }, [hasMoreOlder, loadingOlder, handleLoadOlder]);

  const handleRefresh = async () => {
    setRefreshing(true);
    stickToBottomRef.current = true;
    try {
      await fetchMessages();
    } finally {
      setRefreshing(false);
    }
  };

  const clearSelectedImage = useCallback(() => {
    setImageFile(null);
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImagePreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [imagePreviewUrl]);

  const applyTicketDeleted = useCallback(() => {
    setMessages([]);
    setTotalCount(0);
    setHasMoreOlder(false);
    setReply('');
    setReplyInternal(false);
    clearSelectedImage();
    onTicketDeleted?.();
    broadcastAdminSupportTabEvent({
      type: 'CHAT_PURGED',
      supportRequestId: requestId,
      purgedAt: new Date().toISOString(),
    });
    broadcastAdminSupportTabEvent({ type: 'INVALIDATE_REQUESTS' });
    broadcastAdminSupportTabEvent({ type: 'INVALIDATE_STATS' });
  }, [clearSelectedImage, onTicketDeleted, requestId]);

  const handleDeleteTicket = async () => {
    if (!canDeleteChat) {
      setDeliveryNotice('Only resolved tickets can be deleted.');
      setDeleteConfirmOpen(false);
      return;
    }

    setDeletingChat(true);
    try {
      const res = await fetch(`/api/support-requests/${requestId}/chat`, {
        method: 'DELETE',
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeliveryNotice(payload?.error || 'Failed to delete support ticket.');
        return;
      }
      applyTicketDeleted();
      setDeleteConfirmOpen(false);
    } catch {
      setDeliveryNotice('Failed to delete support ticket. Please try again.');
    } finally {
      setDeletingChat(false);
    }
  };

  useEffect(() => {
    return subscribeAdminSupportChatPurged((payload) => {
      if (payload.supportRequestId !== requestId) return;
      applyTicketDeleted();
    });
  }, [applyTicketDeleted, requestId]);

  const handleSend = async () => {
    const trimmed = reply.trim();
    if ((!trimmed && !imageFile) || sending) return;
    if (replyInternal && imageFile) return;

    const pendingUpload = imageFile ? createPendingUploadState(imageFile) : undefined;
    const optimistic = createOptimisticAdminChatMessage(trimmed, {
      senderName: currentAdminName || 'Admin',
      senderAdminId: currentAdminId,
      visibility: replyInternal ? 'INTERNAL' : 'CUSTOMER',
      pendingUpload,
    });
    activeOutgoingPendingIdRef.current = optimistic._id;

    const savedReply = trimmed;
    const savedReplyInternal = replyInternal;
    const savedImageFile = imageFile;

    setSending(true);
    stickToBottomRef.current = true;
    setMessages((prev) => mergeMessages(prev, [optimistic as ChatMessage]));
    setReply('');
    setReplyInternal(false);
    clearSelectedImage();
    scheduleScrollToBottom();

    try {
      let sent: ChatMessage | null = null;
      const attachment = savedImageFile
        ? await uploadSupportChatImage(requestId, savedImageFile, (progress) => {
            setMessages((prev) =>
              patchPendingMessageUpload(prev, optimistic._id, { progress }),
            );
            if (stickToBottomRef.current) scheduleScrollToBottom();
          })
        : undefined;

      setMessages((prev) =>
        patchPendingMessageUpload(prev, optimistic._id, { progress: 100 }),
      );

      try {
        const ack = await sendSupportChatMessage(requestId, savedReply, {
          internal: savedReplyInternal,
          attachment,
        });
        if (ack.message) {
          sent = ack.message as ChatMessage;
        }
      } catch {
        const res = await fetch(`/api/support-requests/${requestId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: savedReply,
            internal: savedReplyInternal,
            attachment,
          }),
        });
        if (res.ok) {
          sent = await res.json();
        }
      }

      if (sent) {
        setMessages((prev) => replacePendingMessage(prev, optimistic._id, sent as ChatMessage));
        broadcastAdminSupportTabEvent({
          type: 'CHAT_MESSAGE',
          supportRequestId: requestId,
          message: sent,
        });
        broadcastAdminSupportTabEvent({ type: 'INVALIDATE_REQUESTS' });
        broadcastAdminSupportTabEvent({ type: 'INVALIDATE_STATS' });
        window.dispatchEvent(new CustomEvent('admin-support:invalidate-requests'));
        onActivityRef.current?.();
        if (sent.visibility === 'INTERNAL') {
          setDeliveryNotice('Internal note saved — not visible to the customer.');
        } else if (sent.emailSent) {
          setDeliveryNotice('Message sent — customer is offline and was notified by email.');
        } else if (sent.userWasOnline) {
          setDeliveryNotice('Message sent — customer is online in Public Circles.');
        } else {
          setDeliveryNotice('Message sent.');
        }
        requestAnimationFrame(() => {
          scheduleScrollToBottom();
        });
      }
    } catch {
      if (pendingUpload) {
        setMessages((prev) =>
          patchPendingMessageUpload(prev, optimistic._id, { error: 'Upload failed' }),
        );
        window.setTimeout(() => {
          setMessages((prev) => {
            const failed = prev.find((item) => item._id === optimistic._id);
            revokePendingUploadPreview(failed);
            return prev.filter((item) => item._id !== optimistic._id);
          });
        }, 1800);
      } else {
        setMessages((prev) => prev.filter((item) => item._id !== optimistic._id));
      }
      setReply(savedReply);
      setReplyInternal(savedReplyInternal);
    } finally {
      activeOutgoingPendingIdRef.current = null;
      setSending(false);
    }
  };

  const displaySubject = subject || loadedSubject || '';
  const displayTicketMessage = (ticketMessageProp ?? loadedTicketMessage ?? '').trim();
  const latestChatPreview = (() => {
    for (let index = displayMessages.length - 1; index >= 0; index -= 1) {
      const msg = displayMessages[index];
      if (msg.pendingUpload) continue;
      const preview = getChatMessageInboxPreview(msg);
      if (preview && !isSystemMessage(preview)) return preview;
    }
    return undefined;
  })();
  const displayHeadline = getSupportTicketSubjectTitle(
    displaySubject,
    [companyName, userName].filter(Boolean).join(' · ') || 'Support ticket',
  );
  const displayPreview = getSupportTicketPreviewText(
    {
      lastMessagePreview: latestChatPreview,
      message: displayTicketMessage,
      category: loadedCategory,
    },
    { excludeSubject: true },
  );
  const displayAdminNotes = (adminNotesProp ?? loadedAdminNotes ?? '').trim();
  const categoryLabel = loadedCategory
    ? SUPPORT_REQUEST_CATEGORY_LABELS[loadedCategory] ?? loadedCategory
    : null;
  const submittedLabel = loadedCreatedAt
    ? new Date(loadedCreatedAt).toLocaleString()
    : null;

  const isReadOnly = ticketStatus ? READ_ONLY_STATUSES.has(ticketStatus) : false;
  const canDeleteChat =
    isSuperAdmin && Boolean(ticketStatus && READ_ONLY_STATUSES.has(ticketStatus));
  const statusLabel = ticketStatus
    ? SUPPORT_REQUEST_STATUS_LABELS[ticketStatus] ?? ticketStatus
    : null;
  const companyProfileId = companyIdProp || loadedCompanyId;

  useEffect(() => {
    if (!isSuperAdmin || !companyProfileId) {
      setLinkedReferralPartners([]);
      return;
    }

    let cancelled = false;
    fetch(`/api/companies/${companyProfileId}/referral-partners`)
      .then((res) => (res.ok ? res.json() : { partners: [] }))
      .then((data) => {
        if (cancelled) return;
        setLinkedReferralPartners(Array.isArray(data.partners) ? data.partners : []);
      })
      .catch(() => {
        if (!cancelled) setLinkedReferralPartners([]);
      });

    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin, companyProfileId]);

  return (
    <div
      className={cn(
        'flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm',
        className,
      )}
    >
      <div className="border-b bg-muted/20 px-4 py-3.5 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {referenceId && (
                <Badge variant="outline" className="font-mono text-[11px] font-normal shrink-0">
                  {referenceId}
                </Badge>
              )}
              {loadedProjectName ? (
                <Badge variant="secondary" className="text-[11px] font-normal shrink-0">
                  {loadedProjectName}
                </Badge>
              ) : null}
              {statusLabel && ticketStatus && (
                <Badge
                  variant="outline"
                  className={cn('text-[11px] font-normal shrink-0', getStatusBadgeClass(ticketStatus))}
                >
                  {statusLabel}
                </Badge>
              )}
              {isReadOnly && (
                <Badge variant="secondary" className="text-[11px] font-normal gap-1 shrink-0">
                  <Lock className="size-3" />
                  Read-only
                </Badge>
              )}
              {userOnline !== null && (
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] font-normal gap-1 shrink-0 h-5 px-1.5',
                    userOnline
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
                      : 'border-muted-foreground/30 bg-muted/50 text-muted-foreground',
                  )}
                >
                  <span
                    className={cn(
                      'size-1.5 rounded-full',
                      userOnline ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/60',
                    )}
                  />
                  {userOnline ? 'Online' : 'Offline'}
                </Badge>
              )}
            </div>

            <button
              type="button"
              onClick={() => setDetailsExpanded((prev) => !prev)}
              className="flex w-full items-start gap-2 rounded-md text-left transition-colors hover:bg-muted/40 -mx-1 px-1 py-0.5"
              aria-expanded={detailsExpanded}
              aria-label={detailsExpanded ? 'Hide ticket details' : 'Show ticket details'}
            >
              <ChevronDown
                className={cn(
                  'mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200',
                  detailsExpanded && 'rotate-180',
                )}
              />
              <div className="min-w-0 flex-1 space-y-1">
                <h3 className="text-base font-semibold leading-snug">{displayHeadline}</h3>
                {!detailsExpanded && displayPreview && displayPreview !== 'No messages yet' ? (
                  <p className="text-sm text-muted-foreground line-clamp-1" title={displayPreview}>
                    {displayPreview}
                  </p>
                ) : null}
              </div>
            </button>

            {detailsExpanded ? (
              <div className="space-y-2 pl-6">
                {displayPreview && displayPreview !== 'No messages yet' ? (
                  <p className="text-sm text-muted-foreground line-clamp-2" title={displayPreview}>
                    {displayPreview}
                  </p>
                ) : null}
                {(companyName || userName || categoryLabel || submittedLabel || totalCount > 0) && (
                  <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                    {(companyName || userName) && (
                      <p>
                        <span className="font-medium text-foreground/80">Customer:</span>{' '}
                        {[companyName, userName].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {categoryLabel && (
                      <p>
                        <span className="font-medium text-foreground/80">Topic:</span> {categoryLabel}
                      </p>
                    )}
                    {submittedLabel && (
                      <p>
                        <span className="font-medium text-foreground/80">Submitted:</span>{' '}
                        {submittedLabel}
                      </p>
                    )}
                    <p className="flex items-center gap-1">
                      <UserRound className="size-3 shrink-0 opacity-70" />
                      <span className="font-medium text-foreground/80">Assigned to:</span>{' '}
                      {loadedAssignedAdminName?.trim() || 'Unassigned'}
                    </p>
                    {isSuperAdmin ? (
                      <p className="sm:col-span-2">
                        <span className="font-medium text-foreground/80">Referral partners:</span>{' '}
                        {linkedReferralPartners.length > 0
                          ? linkedReferralPartners
                              .map((partner) =>
                                `${partner.name} (${
                                  partner.role === 'SALES_PERSON'
                                    ? 'Sales person'
                                    : 'Marketing affiliate'
                                })`,
                              )
                              .join(' · ')
                          : 'None linked'}
                      </p>
                    ) : null}
                    {totalCount > 0 && (
                      <p>
                        <span className="font-medium text-foreground/80">Messages:</span> {totalCount}
                        {hasMoreOlder ? ' (scroll up for older)' : ''}
                      </p>
                    )}
                  </div>
                )}
                {userOnline === false && !isReadOnly && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Mail className="size-3 shrink-0" />
                    Replies will also be emailed while the customer is away.
                  </p>
                )}
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
            {onCloseTicket &&
              !isReadOnly &&
              (ticketStatus === SUPPORT_REQUEST_STATUS.OPEN ||
                ticketStatus === SUPPORT_REQUEST_STATUS.IN_PROGRESS ||
                ticketStatus === SUPPORT_REQUEST_STATUS.PENDING_RESOLUTION) && (
                <>
                  {ticketStatus === SUPPORT_REQUEST_STATUS.PENDING_RESOLUTION ? null : (
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={onCloseTicket}
                      disabled={closingTicket}
                    >
                      {closingTicket ? (
                        <Loader2 className="size-3 mr-1.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-3 mr-1.5" />
                      )}
                      Close ticket
                    </Button>
                  )}
                  {onForceResolveTicket ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-8 text-xs"
                      onClick={onForceResolveTicket}
                      disabled={closingTicket}
                    >
                      Resolve without confirmation
                    </Button>
                  ) : null}
                </>
              )}
            {companyProfileId && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                asChild
              >
                <Link href={`/dashboard/companies/${companyProfileId}`}>
                  <Building2 className="size-3 mr-1.5" />
                  View company
                </Link>
              </Button>
            )}
            {onOpenManage && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={onOpenManage}
              >
                <Settings2 className="size-3 mr-1.5" />
                Manage
              </Button>
            )}
            {showRefresh && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={handleRefresh}
                disabled={refreshing || loading}
                title="Refresh messages"
              >
                <RefreshCw className={cn('size-4', (refreshing || loading) && 'animate-spin')} />
              </Button>
            )}
          </div>
        </div>
      </div>

      {isReadOnly && (
        <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-4 py-2 shrink-0">
          <p className="text-xs text-muted-foreground">
            This ticket was resolved and cannot be reopened.
          </p>
          {onOpenManage && (
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs shrink-0" onClick={onOpenManage}>
              <Settings2 className="size-3 mr-1.5" />
              Manage ticket
            </Button>
          )}
        </div>
      )}

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="custom-scrollbar flex-1 min-h-0 overflow-y-auto px-4 py-4 bg-muted/5"
      >
        <div ref={messagesContentRef} className="space-y-3">
        {loadingOlder && (
          <div className="flex justify-center pb-2">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {hasMoreOlder && !loadingOlder && (
          <div className="flex justify-center pb-2">
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={handleLoadOlder}>
              Load older messages
            </Button>
          </div>
        )}
        {(displayTicketMessage || (!isPartner && displayAdminNotes)) && (
          <div className="space-y-3 pb-1">
            {displayTicketMessage ? (
              <div className="rounded-lg border bg-background p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Ticket details
                </p>
                <p className="mt-2 text-sm whitespace-pre-wrap leading-relaxed">
                  {displayTicketMessage}
                </p>
              </div>
            ) : null}
            {!isPartner && displayAdminNotes ? (
              <div className="rounded-lg border border-amber-200/80 bg-amber-50/80 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
                <p className="text-[11px] font-medium uppercase tracking-wide text-amber-800 dark:text-amber-300">
                  Private team notes
                </p>
                <p className="mt-1 text-[11px] text-amber-700/80 dark:text-amber-400/80">
                  Internal only — not visible to the customer.
                </p>
                <p className="mt-2 text-sm whitespace-pre-wrap leading-relaxed">
                  {displayAdminNotes}
                </p>
              </div>
            ) : null}
          </div>
        )}
        {loading && messages.length === 0 ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-16">No messages yet.</p>
        ) : (
          displayMessages.map((msg, index) => {
            const messageKey = getSupportChatMessageKey(msg);
            const system = isSystemMessage(msg.message);
            if (system) {
              return (
                <div key={messageKey} className="flex justify-center py-1">
                  <div className="max-w-[90%] rounded-full border border-dashed bg-background px-3 py-1.5 text-center text-[11px] text-muted-foreground">
                    {msg.message.replace(/^\[Ticket reopened\]\s*/i, 'Ticket reopened: ')}
                    <span className="mx-1.5 opacity-40">·</span>
                    {formatMessageTime(msg.createdAt)}
                  </div>
                </div>
              );
            }

            const prevMsg = index > 0 ? displayMessages[index - 1] : null;
            const nextMsg = index < displayMessages.length - 1 ? displayMessages[index + 1] : null;

            const isConsecutivePrev = Boolean(
              prevMsg &&
                prevMsg.senderType === msg.senderType &&
                !isSystemMessage(prevMsg.message) &&
                (msg.senderType === SUPPORT_CHAT_SENDER_TYPE.ADMIN
                  ? prevMsg.senderAdminId === msg.senderAdminId && prevMsg.visibility === msg.visibility
                  : prevMsg.senderName === msg.senderName)
            );

            const isConsecutiveNext = Boolean(
              nextMsg &&
                nextMsg.senderType === msg.senderType &&
                !isSystemMessage(nextMsg.message) &&
                (msg.senderType === SUPPORT_CHAT_SENDER_TYPE.ADMIN
                  ? nextMsg.senderAdminId === msg.senderAdminId && nextMsg.visibility === msg.visibility
                  : nextMsg.senderName === msg.senderName)
            );

            const isAdmin = msg.senderType === SUPPORT_CHAT_SENDER_TYPE.ADMIN;
            const isInternal = msg.visibility === 'INTERNAL';
            if (isPartner && isInternal) {
              return null;
            }
            const label = getSupportMessageSenderLabel({
              senderType: msg.senderType,
              senderName: msg.senderName,
              senderAdminId: msg.senderAdminId,
              senderRoleLabel: msg.senderRoleLabel,
              currentAdminId,
              currentAdminName,
              customerFallbackName: userName,
              resolveAdminRole,
            });

            const showBubble = messageHasDisplayableContent(msg);
            const hasImage = messageHasImage(msg);
            const showText = shouldShowChatMessageText(msg.message, { hasImage });

            if (!showBubble) {
              return null;
            }

            return (
              <div key={messageKey} className={cn('flex w-full', isAdmin ? 'justify-end' : 'justify-start', isConsecutivePrev && '!mt-1.5')}>
                <div className={cn('max-w-[82%] space-y-1 flex flex-col', isAdmin ? 'items-end' : 'items-start')}>
                  {!isConsecutivePrev && (
                    <p
                      className={cn(
                        'text-[11px] font-medium text-muted-foreground px-1',
                        isAdmin && 'text-right',
                      )}
                    >
                      {label}
                      {isInternal ? (
                        <span className="ml-1.5 font-normal text-amber-700 dark:text-amber-300">
                          · Internal
                        </span>
                      ) : null}
                    </p>
                  )}
                  {(showText || hasImage) ? (
                    hasImage ? (
                      <SupportChatMessageContent
                        message={msg.message}
                        attachment={msg.attachment}
                        pendingUpload={msg.pendingUpload}
                        imageTone={isAdmin ? 'support' : 'user'}
                        createdAt={msg.createdAt}
                        isConsecutivePrev={isConsecutivePrev}
                        isConsecutiveNext={isConsecutiveNext}
                        isInternal={isInternal}
                        onMediaLoad={() => {
                          if (stickToBottomRef.current) scheduleScrollToBottom();
                        }}
                        onRemoteImageReady={() => {
                          if (msg.pendingUpload) {
                            handleClearPendingUpload(msg._id);
                          }
                          if (stickToBottomRef.current) scheduleScrollToBottom();
                        }}
                      />
                    ) : (
                      <>
                        <div
                          className={cn(
                            'rounded-2xl text-sm shadow-sm px-3.5 py-2.5',
                            isAdmin
                              ? isInternal
                                ? cn(
                                    'bg-amber-50/90 text-foreground border border-amber-200/80 border-dashed dark:bg-amber-950/25 dark:border-amber-900/50',
                                    isConsecutivePrev && isConsecutiveNext
                                      ? 'rounded-r-md'
                                      : isConsecutivePrev
                                      ? 'rounded-br-md'
                                      : isConsecutiveNext
                                      ? 'rounded-tr-md'
                                      : 'rounded-br-md',
                                  )
                                : cn(
                                    'bg-muted text-foreground border border-border/80',
                                    isConsecutivePrev && isConsecutiveNext
                                      ? 'rounded-r-md'
                                      : isConsecutivePrev
                                      ? 'rounded-br-md'
                                      : isConsecutiveNext
                                      ? 'rounded-tr-md'
                                      : 'rounded-br-md',
                                  )
                              : cn(
                                  'bg-background border',
                                  isConsecutivePrev && isConsecutiveNext
                                    ? 'rounded-l-md'
                                    : isConsecutivePrev
                                    ? 'rounded-bl-md'
                                    : isConsecutiveNext
                                    ? 'rounded-tl-md'
                                    : 'rounded-bl-md',
                                )
                          )}
                        >
                          <SupportChatMessageContent
                            message={msg.message}
                            attachment={msg.attachment}
                            pendingUpload={msg.pendingUpload}
                            imageTone={isAdmin ? 'support' : 'user'}
                            onMediaLoad={() => {
                              if (stickToBottomRef.current) scheduleScrollToBottom();
                            }}
                            onRemoteImageReady={() => {
                              if (msg.pendingUpload) {
                                handleClearPendingUpload(msg._id);
                              }
                              if (stickToBottomRef.current) scheduleScrollToBottom();
                            }}
                          />
                        </div>
                        <p
                          className={cn(
                            'text-[10px] tabular-nums text-muted-foreground px-1',
                            isAdmin ? 'text-right' : 'text-left',
                          )}
                        >
                          {formatMessageTime(msg.createdAt)}
                        </p>
                      </>
                    )
                  ) : null}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} aria-hidden className="h-px shrink-0" />
        </div>
      </div>

      <div className="shrink-0 border-t bg-muted/15 px-4 py-3">
        {deliveryNotice ? (
          <p className="mb-2 text-[11px] leading-snug text-muted-foreground">{deliveryNotice}</p>
        ) : null}
        {isReadOnly ? (
          <p className="py-1 text-center text-xs text-muted-foreground">
            {`Replies disabled while ticket is ${statusLabel?.toLowerCase() ?? 'closed'}.`}
          </p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              {!isPartner ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={sending}
                  onClick={() => setReplyInternal((prev) => !prev)}
                  className={cn(
                    'h-7 gap-1.5 px-2.5 text-xs font-normal',
                    replyInternal
                      ? 'bg-amber-100 text-amber-900 hover:bg-amber-100/90 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/50'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Lock className="size-3 shrink-0" />
                  Internal note
                  {replyInternal ? (
                    <span className="rounded-full bg-amber-200/80 px-1.5 py-px text-[10px] font-medium text-amber-900 dark:bg-amber-800/60 dark:text-amber-100">
                      On
                    </span>
                  ) : null}
                </Button>
              ) : (
                <span />
              )}
              <span className="hidden text-[10px] text-muted-foreground sm:inline">
                Enter to send · Shift+Enter for new line
              </span>
            </div>
            {imagePreviewUrl ? (
              <div className="flex items-center gap-2 rounded-lg border bg-background px-2 py-2">
                <img
                  src={imagePreviewUrl}
                  alt={imageFile?.name || 'Selected image'}
                  className="h-14 w-14 rounded-md object-cover"
                />
                <div className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {imageFile?.name}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  onClick={clearSelectedImage}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ) : null}
            <div
              className={cn(
                'flex items-end gap-2 rounded-2xl border bg-background px-2 py-1.5 shadow-sm transition-colors',
                replyInternal
                  ? 'border-amber-200/90 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/15'
                  : 'border-border/80',
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={SUPPORT_CHAT_IMAGE_ACCEPT}
                className="hidden"
                disabled={replyInternal || sending}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const validationError = validateSupportChatImageFile(file);
                  if (validationError) {
                    setDeliveryNotice(validationError);
                    return;
                  }
                  if (imagePreviewUrl) {
                    URL.revokeObjectURL(imagePreviewUrl);
                  }
                  setImageFile(file);
                  setImagePreviewUrl(URL.createObjectURL(file));
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mb-0.5 size-9 shrink-0 rounded-full"
                disabled={sending || replyInternal}
                onClick={() => fileInputRef.current?.click()}
                title="Attach image"
              >
                <ImagePlus className="size-4" />
              </Button>
              <Textarea
                placeholder={
                  replyInternal
                    ? 'Write an internal note for your team…'
                    : 'Write a reply to the customer…'
                }
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={1}
                disabled={sending}
                className="max-h-32 min-h-[40px] flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <SupportChatSendButton
                onClick={handleSend}
                disabled={sending || (!reply.trim() && !imageFile)}
                loading={sending}
                title={replyInternal ? 'Save internal note' : 'Send reply'}
                className={cn(
                  'mb-0.5 size-9',
                  replyInternal
                    ? 'bg-amber-600 text-white hover:bg-amber-700'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90',
                )}
              />
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete this ticket?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  This will <strong className="text-foreground">permanently delete the ticket</strong>,
                  all chat messages, related notifications, and every attached image from S3 storage.
                </p>
                <p>This action cannot be undone.</p>
                <p>Available only for resolved tickets.</p>
                {totalCount > 0 ? (
                  <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
                    About to delete <strong>{totalCount}</strong> message
                    {totalCount === 1 ? '' : 's'}
                    {messages.some((msg) => msg.attachment?.viewUrl) ? ' including image attachments' : ''}.
                  </p>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingChat}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingChat}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteTicket();
              }}
            >
              {deletingChat ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                'Delete ticket permanently'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
