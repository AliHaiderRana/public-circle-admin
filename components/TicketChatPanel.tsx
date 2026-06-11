'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Send,
  RefreshCw,
  Lock,
  ImagePlus,
  X,
  Settings2,
  Mail,
  Building2,
  CheckCircle2,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  SUPPORT_CHAT_SENDER_TYPE,
  SUPPORT_REQUEST_CATEGORY_LABELS,
  SUPPORT_REQUEST_STATUS,
  SUPPORT_REQUEST_STATUS_LABELS,
} from '@/lib/constants';
import { getAdminMessageLabel } from '@/lib/support-admin.util';
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
import {
  SUPPORT_CHAT_IMAGE_ACCEPT,
  uploadSupportChatImage,
  validateSupportChatImageFile,
  type SupportChatAttachment,
} from '@/lib/support-chat-attachment';
import {
  SupportChatImagePreview,
  SupportChatImageThumbnail,
} from '@/components/SupportChatImagePreview';

const CHAT_PAGE_SIZE = 30;
const CHAT_POLL_MS = 15000;

type ChatMessage = {
  _id: string;
  senderType: string;
  senderName: string;
  senderAdminId?: string;
  message: string;
  createdAt: string;
  visibility?: 'CUSTOMER' | 'INTERNAL';
  attachment?: SupportChatAttachment;
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
  className?: string;
  onActivity?: () => void;
  onOpenManage?: () => void;
  onCloseTicket?: () => void;
  closingTicket?: boolean;
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
  className,
  onActivity,
  onOpenManage,
  onCloseTicket,
  closingTicket = false,
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
  const [fullscreenImage, setFullscreenImage] = useState<{
    src: string;
    alt: string;
  } | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const initialLoadNotifiedRef = useRef(false);
  const onActivityRef = useRef(onActivity);
  const onTicketLoadedRef = useRef(onTicketLoaded);
  const lastTicketMetaRef = useRef<string>('');
  const markedSeenForTicketRef = useRef<string | null>(null);
  const fetchMessagesRef = useRef<
    (before?: string, opts?: { silent?: boolean }) => Promise<void>
  >(() => Promise.resolve());
  const markTicketSeenRef = useRef<() => void>(() => undefined);

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

  const scrollToBottomIfNearEnd = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 64;
    if (nearBottom) {
      stickToBottomRef.current = true;
      requestAnimationFrame(() => {
        const scrollEl = scrollContainerRef.current;
        if (!scrollEl) return;
        scrollEl.scrollTop = scrollEl.scrollHeight;
      });
    } else {
      stickToBottomRef.current = false;
    }
  }, []);

  const mergeMessages = useCallback((existing: ChatMessage[], incoming: ChatMessage[]) => {
    const map = new Map<string, ChatMessage>();
    [...existing, ...incoming].forEach((message) => map.set(message._id, message));
    return Array.from(map.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, []);

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
            if (!initialLoadNotifiedRef.current) {
              initialLoadNotifiedRef.current = true;
              onActivityRef.current?.();
            }
            markTicketSeenRef.current?.();
          }
          if (stickToBottomRef.current) {
            requestAnimationFrame(() => {
              if (!scrollEl) return;
              scrollEl.scrollTop = scrollEl.scrollHeight;
            });
          }
        }
      } finally {
        if (isOlderPage) setLoadingOlder(false);
        else if (!silent) setLoading(false);
      }
    },
    [mergeMessages, requestId],
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
    lastTicketMetaRef.current = '';
    stickToBottomRef.current = true;
    initialLoadNotifiedRef.current = false;
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
        setMessages((prev) => mergeMessages(prev, [payload.message]));
        scrollToBottomIfNearEnd();
        if (payload.message.senderType === SUPPORT_CHAT_SENDER_TYPE.USER) {
          markedSeenForTicketRef.current = null;
          markTicketSeenRef.current?.();
        }
        onActivityRef.current?.();
        broadcastAdminSupportTabEvent({
          type: 'CHAT_MESSAGE',
          supportRequestId: payload.supportRequestId,
          message: payload.message,
        });
        broadcastAdminSupportTabEvent({ type: 'INVALIDATE_REQUESTS' });
        broadcastAdminSupportTabEvent({ type: 'INVALIDATE_STATS' });
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
      setMessages((prev) => mergeMessages(prev, [payload.message]));
      scrollToBottomIfNearEnd();
      onActivityRef.current?.();
    });
  }, [requestId, mergeMessages, scrollToBottomIfNearEnd]);

  useEffect(() => {
    if (!refreshKey) return;
    initialLoadNotifiedRef.current = false;
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
    initialLoadNotifiedRef.current = false;
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

  const handleSend = async () => {
    const trimmed = reply.trim();
    if ((!trimmed && !imageFile) || sending) return;
    if (replyInternal && imageFile) return;
    setSending(true);
    try {
      let sent: ChatMessage | null = null;
      const attachment = imageFile ? await uploadSupportChatImage(requestId, imageFile) : undefined;

      try {
        const ack = await sendSupportChatMessage(requestId, trimmed, {
          internal: replyInternal,
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
            message: trimmed,
            internal: replyInternal,
            attachment,
          }),
        });
        if (res.ok) {
          sent = await res.json();
        }
      }

      if (sent) {
        stickToBottomRef.current = true;
        setMessages((prev) => mergeMessages(prev, [sent]));
        broadcastAdminSupportTabEvent({
          type: 'CHAT_MESSAGE',
          supportRequestId: requestId,
          message: sent,
        });
        broadcastAdminSupportTabEvent({ type: 'INVALIDATE_REQUESTS' });
        broadcastAdminSupportTabEvent({ type: 'INVALIDATE_STATS' });
        setReply('');
        setReplyInternal(false);
        clearSelectedImage();
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
          const el = scrollContainerRef.current;
          if (el) el.scrollTop = el.scrollHeight;
        });
      }
    } finally {
      setSending(false);
    }
  };

  const displaySubject = subject || loadedSubject || 'Support ticket';
  const displayTicketMessage = (ticketMessageProp ?? loadedTicketMessage ?? '').trim();
  const displayAdminNotes = (adminNotesProp ?? loadedAdminNotes ?? '').trim();
  const categoryLabel = loadedCategory
    ? SUPPORT_REQUEST_CATEGORY_LABELS[loadedCategory] ?? loadedCategory
    : null;
  const submittedLabel = loadedCreatedAt
    ? new Date(loadedCreatedAt).toLocaleString()
    : null;

  const isReadOnly = ticketStatus ? READ_ONLY_STATUSES.has(ticketStatus) : false;
  const statusLabel = ticketStatus
    ? SUPPORT_REQUEST_STATUS_LABELS[ticketStatus] ?? ticketStatus
    : null;
  const companyProfileId = companyIdProp || loadedCompanyId;

  return (
    <div
      className={cn(
        'flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm',
        className,
      )}
    >
      <div className="border-b bg-muted/20 px-4 py-3.5 shrink-0 space-y-3">
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
            <h3 className="text-base font-semibold leading-snug">{displaySubject}</h3>
            {(companyName || userName || categoryLabel || submittedLabel) && (
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
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
            {onCloseTicket &&
              !isReadOnly &&
              (ticketStatus === SUPPORT_REQUEST_STATUS.OPEN ||
                ticketStatus === SUPPORT_REQUEST_STATUS.IN_PROGRESS) && (
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
        className="custom-scrollbar flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3 bg-muted/5"
      >
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
        {(displayTicketMessage || displayAdminNotes) && (
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
            {displayAdminNotes ? (
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
          messages.map((msg) => {
            const system = isSystemMessage(msg.message);
            if (system) {
              return (
                <div key={msg._id} className="flex justify-center py-1">
                  <div className="max-w-[90%] rounded-full border border-dashed bg-background px-3 py-1.5 text-center text-[11px] text-muted-foreground">
                    {msg.message.replace(/^\[Ticket reopened\]\s*/i, 'Ticket reopened: ')}
                    <span className="mx-1.5 opacity-40">·</span>
                    {formatMessageTime(msg.createdAt)}
                  </div>
                </div>
              );
            }

            const isAdmin = msg.senderType === SUPPORT_CHAT_SENDER_TYPE.ADMIN;
            const isInternal = msg.visibility === 'INTERNAL';
            const label = isAdmin
              ? getAdminMessageLabel(
                  msg.senderName,
                  msg.senderAdminId,
                  currentAdminId,
                  currentAdminName,
                )
              : msg.senderName?.trim() || userName || 'Customer';

            return (
              <div key={msg._id} className={cn('flex', isAdmin ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[82%] space-y-1', isAdmin ? 'items-end' : 'items-start')}>
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
                  <div
                    className={cn(
                      'rounded-2xl px-3.5 py-2.5 text-sm shadow-sm',
                      isAdmin
                        ? isInternal
                          ? 'bg-amber-50/90 text-foreground border border-amber-200/80 border-dashed rounded-br-md dark:bg-amber-950/25 dark:border-amber-900/50'
                          : 'bg-muted text-foreground border border-border/80 rounded-br-md'
                        : 'bg-background border rounded-bl-md',
                    )}
                  >
                    {msg.attachment?.viewUrl ? (
                      <SupportChatImageThumbnail
                        src={msg.attachment.viewUrl}
                        alt={msg.attachment.originalName || 'Chat image'}
                        onClick={() =>
                          setFullscreenImage({
                            src: msg.attachment!.viewUrl!,
                            alt: msg.attachment?.originalName || 'Chat image',
                          })
                        }
                      />
                    ) : null}
                    {msg.message?.trim() ? (
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                    ) : null}
                    <p className="text-[10px] mt-1.5 tabular-nums text-muted-foreground text-right">
                      {formatMessageTime(msg.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="shrink-0 border-t bg-muted/15 px-4 py-3">
        {deliveryNotice ? (
          <p className="mb-2 text-[11px] leading-snug text-muted-foreground">{deliveryNotice}</p>
        ) : null}
        {isReadOnly ? (
          <p className="py-1 text-center text-xs text-muted-foreground">
            Replies disabled while ticket is {statusLabel?.toLowerCase() ?? 'closed'}.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
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
              <Button
                onClick={handleSend}
                disabled={sending || (!reply.trim() && !imageFile)}
                size="icon"
                className={cn(
                  'mb-0.5 size-9 shrink-0 rounded-full',
                  replyInternal
                    ? 'bg-amber-600 text-white hover:bg-amber-700'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90',
                )}
                title={replyInternal ? 'Save internal note' : 'Send reply'}
              >
                {sending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      <SupportChatImagePreview
        src={fullscreenImage?.src ?? null}
        alt={fullscreenImage?.alt}
        open={Boolean(fullscreenImage)}
        onOpenChange={(open) => {
          if (!open) setFullscreenImage(null);
        }}
      />
    </div>
  );
}
