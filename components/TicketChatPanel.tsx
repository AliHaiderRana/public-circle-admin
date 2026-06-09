'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, RefreshCw, Lock, Settings2, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TicketStatusTimeline } from '@/components/support/TicketStatusTimeline';
import type { StatusTimelineEntry } from '@/lib/support-status-timeline.util';
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

const CHAT_PAGE_SIZE = 30;
const CHAT_POLL_MS = 5000;

type ChatMessage = {
  _id: string;
  senderType: string;
  senderName: string;
  senderAdminId?: string;
  message: string;
  createdAt: string;
};

type TicketChatPanelProps = {
  requestId: string;
  referenceId?: string;
  subject?: string;
  companyName?: string;
  userName?: string;
  currentAdminId?: string;
  currentAdminName?: string;
  className?: string;
  onActivity?: () => void;
  onOpenManage?: () => void;
  onTicketLoaded?: (ticket: {
    adminNotes?: string;
    message?: string;
    subject?: string;
    status?: string;
    unreadByAdmin?: number;
    assignedAdminId?: string | null;
    assignedAdminName?: string;
    updatedAt?: string;
  }) => void;
  adminNotes?: string;
  initialMessage?: string;
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
  companyName,
  userName,
  currentAdminId,
  currentAdminName,
  className,
  onActivity,
  onOpenManage,
  onTicketLoaded,
  adminNotes: adminNotesProp,
  initialMessage: initialMessageProp,
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
  const [sending, setSending] = useState(false);
  const [ticketStatus, setTicketStatus] = useState<string | null>(null);
  const [loadedSubject, setLoadedSubject] = useState<string | undefined>();
  const [loadedAdminNotes, setLoadedAdminNotes] = useState<string | undefined>();
  const [loadedInitialMessage, setLoadedInitialMessage] = useState<string | undefined>();
  const [loadedCategory, setLoadedCategory] = useState<string | undefined>();
  const [loadedCreatedAt, setLoadedCreatedAt] = useState<string | undefined>();
  const [statusTimeline, setStatusTimeline] = useState<StatusTimelineEntry[]>([]);
  const socketReadyRef = useRef(false);
  const [userOnline, setUserOnline] = useState<boolean | null>(null);
  const [deliveryNotice, setDeliveryNotice] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const initialLoadNotifiedRef = useRef(false);
  const onActivityRef = useRef(onActivity);
  const onTicketLoadedRef = useRef(onTicketLoaded);
  const lastTicketMetaRef = useRef<string>('');
  const fetchMessagesRef = useRef<
    (before?: string, opts?: { silent?: boolean }) => Promise<void>
  >(() => Promise.resolve());

  useEffect(() => {
    onActivityRef.current = onActivity;
  }, [onActivity]);

  useEffect(() => {
    onTicketLoadedRef.current = onTicketLoaded;
  }, [onTicketLoaded]);

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
          const notes = typeof data.ticket.adminNotes === 'string' ? data.ticket.adminNotes : '';
          const initial =
            typeof data.ticket.message === 'string' ? data.ticket.message : '';
          setLoadedAdminNotes(notes);
          setLoadedInitialMessage(initial);
          setLoadedCategory(
            typeof data.ticket.category === 'string' ? data.ticket.category : undefined,
          );
          setLoadedCreatedAt(
            typeof data.ticket.createdAt === 'string' ? data.ticket.createdAt : undefined,
          );
          setStatusTimeline(
            Array.isArray(data.ticket.statusTimeline) ? data.ticket.statusTimeline : [],
          );
          if (typeof data.userOnline === 'boolean') {
            setUserOnline(data.userOnline);
          } else if (typeof data.ticket.userOnline === 'boolean') {
            setUserOnline(data.ticket.userOnline);
          }
          const metaKey = [
            notes,
            initial,
            data.ticket.subject ?? '',
            data.ticket.status ?? '',
            data.ticket.unreadByAdmin ?? '',
            data.ticket.assignedAdminId ?? '',
            data.ticket.updatedAt ?? '',
            Array.isArray(data.ticket.statusTimeline) ? data.ticket.statusTimeline.length : 0,
          ].join('|');
          if (metaKey !== lastTicketMetaRef.current) {
            lastTicketMetaRef.current = metaKey;
            onTicketLoadedRef.current?.({
              adminNotes: notes,
              message: initial,
              subject: data.ticket.subject,
              status: data.ticket.status,
              unreadByAdmin:
                typeof data.ticket.unreadByAdmin === 'number'
                  ? data.ticket.unreadByAdmin
                  : undefined,
              assignedAdminId: data.ticket.assignedAdminId ?? null,
              assignedAdminName: data.ticket.assignedAdminName,
              updatedAt: data.ticket.updatedAt,
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
    setMessages([]);
    setHasMoreOlder(false);
    setTotalCount(0);
    setTicketStatus(null);
    setLoadedSubject(undefined);
    setLoadedAdminNotes(undefined);
    setLoadedInitialMessage(undefined);
    setLoadedCategory(undefined);
    setLoadedCreatedAt(undefined);
    setStatusTimeline([]);
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
      load(undefined, true);
    }, CHAT_POLL_MS);

    let unsubscribe: (() => void) | undefined;

    void (async () => {
      const activeSocket = await getSupportSocket();
      if (cancelled || !activeSocket) return;

      unsubscribe = subscribeSupportChatMessage(activeSocket, (payload) => {
        if (payload.supportRequestId !== requestId || !payload.message) return;
        stickToBottomRef.current = true;
        setMessages((prev) => mergeMessages(prev, [payload.message]));
        void fetchMessagesRef.current(undefined, { silent: true });
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
    };
  }, [requestId, mergeMessages]);

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

  const handleSend = async () => {
    const trimmed = reply.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      let sent: {
        _id: string;
        senderType: string;
        senderName: string;
        senderAdminId?: string;
        message: string;
        createdAt: string;
        emailSent?: boolean;
        userWasOnline?: boolean;
      } | null = null;

      try {
        const ack = await sendSupportChatMessage(requestId, trimmed);
        if (ack.message) {
          sent = ack.message;
        }
      } catch {
        const res = await fetch(`/api/support-requests/${requestId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: trimmed }),
        });
        if (res.ok) {
          sent = await res.json();
        }
      }

      if (sent) {
        stickToBottomRef.current = true;
        setMessages((prev) => mergeMessages(prev, [sent]));
        setReply('');
        onActivityRef.current?.();
        if (sent.emailSent) {
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
  const rawAdminNotes = (adminNotesProp ?? loadedAdminNotes ?? '').trim();
  const displayInitialMessage = (initialMessageProp ?? loadedInitialMessage ?? '').trim();
  const categoryLabel = loadedCategory
    ? SUPPORT_REQUEST_CATEGORY_LABELS[loadedCategory] ?? loadedCategory
    : null;
  const submittedLabel = loadedCreatedAt
    ? new Date(loadedCreatedAt).toLocaleString()
    : null;

  const displayAdminNotes = rawAdminNotes;
  const showTicketHistory =
    Boolean(displayInitialMessage || displayAdminNotes || statusTimeline.length > 0) &&
    !loading;

  const isReadOnly = ticketStatus ? READ_ONLY_STATUSES.has(ticketStatus) : false;
  const statusLabel = ticketStatus
    ? SUPPORT_REQUEST_STATUS_LABELS[ticketStatus] ?? ticketStatus
    : null;

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm min-h-[420px]',
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
          <div className="flex shrink-0 items-center gap-1">
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
        className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3 bg-muted/5"
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
        {showTicketHistory && (
          <div className="rounded-xl border bg-background p-3.5 space-y-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Ticket history
            </p>
            {statusTimeline.length > 0 && (
              <TicketStatusTimeline entries={statusTimeline} compact />
            )}
            {displayInitialMessage && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-[11px] font-medium text-muted-foreground mb-1.5">
                  Original customer message
                  {submittedLabel ? (
                    <span className="font-normal"> · {submittedLabel}</span>
                  ) : null}
                </p>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{displayInitialMessage}</p>
              </div>
            )}
            {displayAdminNotes && (
              <div className="rounded-lg border border-amber-200/80 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/20 p-3">
                <p className="text-[11px] font-medium text-amber-900 dark:text-amber-200 mb-1">
                  Private team notes
                </p>
                <p className="text-[11px] text-muted-foreground mb-1.5">
                  Read-only — not visible to the customer.
                </p>
                <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90">
                  {displayAdminNotes}
                </p>
              </div>
            )}
          </div>
        )}
        {showTicketHistory && messages.length > 0 && (
          <div className="flex items-center gap-3 py-1">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Conversation
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>
        )}
        {loading && messages.length === 0 && !showTicketHistory ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 && !showTicketHistory ? (
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
                  </p>
                  <div
                    className={cn(
                      'rounded-2xl px-3.5 py-2.5 text-sm shadow-sm',
                      isAdmin
                        ? 'bg-muted text-foreground border border-border/80 rounded-br-md'
                        : 'bg-background border rounded-bl-md',
                    )}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                    <p
                      className={cn(
                        'text-[10px] mt-1.5 tabular-nums text-muted-foreground text-right',
                      )}
                    >
                      {formatMessageTime(msg.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t bg-background p-3 shrink-0 space-y-2">
        {deliveryNotice && (
          <p className="text-xs text-muted-foreground text-center px-2">{deliveryNotice}</p>
        )}
        {isReadOnly ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            Replies disabled while ticket is {statusLabel?.toLowerCase() ?? 'closed'}.
          </p>
        ) : (
          <div className="flex gap-2 items-end">
            <Textarea
              placeholder="Type a reply…"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={2}
              disabled={sending}
              className="min-h-[72px] resize-none flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button
              onClick={handleSend}
              disabled={sending || !reply.trim()}
              size="icon"
              className="size-10 shrink-0"
              title="Send reply"
            >
              {sending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
