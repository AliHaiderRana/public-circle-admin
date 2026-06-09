'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  SUPPORT_REQUEST_STATUS,
  SUPPORT_REQUEST_CATEGORY,
  SUPPORT_REQUEST_CATEGORY_LABELS,
  SUPPORT_REQUEST_STATUS_LABELS,
} from '@/lib/constants';
import {
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Inbox,
  Settings2,
  RefreshCw,
} from 'lucide-react';
import { useSupportStats } from '@/hooks/use-support-stats';
import { SupportCountBadge } from '@/components/SupportCountBadge';
import { TicketChatPanel } from '@/components/TicketChatPanel';
import { SupportInboxShell } from '@/components/support/SupportInboxShell';
import { TicketStatusTimeline } from '@/components/support/TicketStatusTimeline';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { formatAdminDisplayName, formatSupportReferenceId } from '@/lib/support-admin.util';
import { getSupportSocket } from '@/lib/support-socket';
import type { StatusTimelineEntry } from '@/lib/support-status-timeline.util';

type SupportRequestRow = {
  _id: string;
  referenceId?: string;
  category: string;
  subject: string;
  message: string;
  status: string;
  adminNotes?: string;
  createdAt: string;
  updatedAt?: string;
  unreadByAdmin?: number;
  assignedAdminId?: string | null;
  assignedAdminName?: string;
  lastAdminReplyName?: string;
  companyId?: { _id?: string; name?: string } | string;
  userId?: { firstName?: string; lastName?: string; emailAddress?: string };
};

type AssignableAdmin = {
  id: string;
  name: string;
  email: string;
  isSuperAdmin: boolean;
};

function formatQueueDate(value: string) {
  const date = new Date(value);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getTicketReferenceId(request: SupportRequestRow): string {
  return request.referenceId || formatSupportReferenceId(request._id);
}

function getCompanyId(request: SupportRequestRow): string | null {
  if (!request.companyId) return null;
  if (typeof request.companyId === 'string') return request.companyId;
  return request.companyId._id ? String(request.companyId._id) : null;
}

function getCompanyName(request: SupportRequestRow): string {
  if (!request.companyId) return 'Unknown company';
  if (typeof request.companyId === 'string') return 'Unknown company';
  return request.companyId.name || 'Unknown company';
}

function formatUser(user?: SupportRequestRow['userId']) {
  if (!user) return 'Unknown user';
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
  return name || user.emailAddress || 'Unknown user';
}

function isActiveStatus(status: string) {
  return (
    status === SUPPORT_REQUEST_STATUS.OPEN ||
    status === SUPPORT_REQUEST_STATUS.IN_PROGRESS ||
    status === SUPPORT_REQUEST_STATUS.PENDING_RESOLUTION
  );
}

function isTicketAssigned(request: SupportRequestRow): boolean {
  return Boolean(request.assignedAdminId);
}

function isAssignedToAdmin(request: SupportRequestRow, adminId?: string): boolean {
  if (!adminId || !request.assignedAdminId) return false;
  return String(request.assignedAdminId) === adminId;
}

export default function SupportRequestsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const currentAdminId = user?.id ? String(user.id) : undefined;
  const currentAdminName = formatAdminDisplayName(user?.name, user?.email);
  const isSuperAdmin = Boolean(user?.isSuperAdmin);
  const highlightRequestId = searchParams.get('highlight');
  const activeTicketId = searchParams.get('ticket');
  const { stats, refresh: refreshStats } = useSupportStats();
  const highlightedRowRef = useRef<HTMLButtonElement>(null);

  const selectTicket = useCallback(
    (ticketId: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (ticketId) {
        params.set('ticket', ticketId);
      } else {
        params.delete('ticket');
      }
      const qs = params.toString();
      router.replace(
        qs ? `/dashboard/support-requests?${qs}` : '/dashboard/support-requests',
        { scroll: false },
      );
    },
    [router, searchParams],
  );

  const [requests, setRequests] = useState<SupportRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [activeOnlyFilter, setActiveOnlyFilter] = useState(false);
  const [unassignedOnlyFilter, setUnassignedOnlyFilter] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [highlightFading, setHighlightFading] = useState(false);
  const [manageRequest, setManageRequest] = useState<SupportRequestRow | null>(null);
  const [manageAssigneeId, setManageAssigneeId] = useState('');
  const [manageNotes, setManageNotes] = useState('');
  const [assignableAdmins, setAssignableAdmins] = useState<AssignableAdmin[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    pages: 0,
  });
  const [chatRefreshKey, setChatRefreshKey] = useState(0);
  const [offPageTicket, setOffPageTicket] = useState<SupportRequestRow | null>(null);
  const [manageStatusTimeline, setManageStatusTimeline] = useState<StatusTimelineEntry[]>([]);
  const [loadingManageTimeline, setLoadingManageTimeline] = useState(false);

  const openManage = useCallback((request: SupportRequestRow) => {
    setManageRequest(request);
    setManageNotes(request.adminNotes ?? '');
    setManageAssigneeId(request.assignedAdminId ? String(request.assignedAdminId) : 'unassigned');
    setManageStatusTimeline([]);
  }, []);

  const manageRequestId = manageRequest?._id ?? '';
  const manageRequestStatus = manageRequest?.status ?? '';
  const manageRequestUpdatedAt = manageRequest?.updatedAt ?? '';

  useEffect(() => {
    if (!manageRequestId) {
      setManageStatusTimeline([]);
      return;
    }

    let cancelled = false;
    setLoadingManageTimeline(true);

    fetch(`/api/support-requests/${manageRequestId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        if (Array.isArray(data.statusTimeline)) {
          setManageStatusTimeline(data.statusTimeline);
        }
      })
      .catch(() => {
        if (!cancelled) setManageStatusTimeline([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingManageTimeline(false);
      });

    return () => {
      cancelled = true;
    };
  }, [manageRequestId, manageRequestStatus, manageRequestUpdatedAt, chatRefreshKey]);

  useEffect(() => {
    void getSupportSocket();
  }, []);

  useEffect(() => {
    if (!isSuperAdmin) {
      setAssignableAdmins([]);
      return;
    }
    fetch('/api/support/assignable-admins')
      .then((res) => (res.ok ? res.json() : { admins: [] }))
      .then((data) => setAssignableAdmins(data.admins ?? []))
      .catch(() => setAssignableAdmins([]));
  }, [isSuperAdmin]);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(activeOnlyFilter ? { activeOnly: 'true' } : statusFilter ? { status: statusFilter } : {}),
        ...(unassignedOnlyFilter ? { unassignedOnly: 'true' } : {}),
        ...(categoryFilter && { category: categoryFilter }),
      });

      const res = await fetch(`/api/support-requests?${params}`);
      const data = await res.json();

      if (data.requests) {
        setRequests(data.requests);
        setPagination(data.pagination);
      } else {
        setRequests([]);
      }
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, searchTerm, statusFilter, activeOnlyFilter, unassignedOnlyFilter, categoryFilter]);

  const handlePageChange = useCallback((page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  }, []);

  const paginationRange = useMemo(() => {
    if (pagination.total === 0) return null;
    const start = (pagination.page - 1) * pagination.limit + 1;
    const end = Math.min(pagination.page * pagination.limit, pagination.total);
    return { start, end };
  }, [pagination.page, pagination.limit, pagination.total]);

  const handleRefreshAll = useCallback(async () => {
    await Promise.all([fetchRequests(), refreshStats()]);
    if (activeTicketId) {
      setChatRefreshKey((key) => key + 1);
    }
  }, [fetchRequests, refreshStats, activeTicketId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    if (highlightRequestId && !loading && highlightedRowRef.current) {
      highlightedRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const timer = setTimeout(() => setHighlightFading(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [highlightRequestId, loading, requests]);

  useEffect(() => {
    if (
      highlightRequestId &&
      requests.some((request) => request._id === highlightRequestId) &&
      activeTicketId !== highlightRequestId
    ) {
      selectTicket(highlightRequestId);
    }
  }, [highlightRequestId, requests, activeTicketId, selectTicket]);

  useEffect(() => {
    if (loading || activeTicketId || highlightRequestId || requests.length === 0) return;
    const firstUnread = requests.find((request) => (request.unreadByAdmin ?? 0) > 0);
    const firstActive = requests.find((request) => isActiveStatus(request.status));
    const pick = firstUnread ?? firstActive ?? requests[0];
    if (pick) selectTicket(pick._id);
  }, [loading, activeTicketId, highlightRequestId, requests, selectTicket]);

  const handleChatActivity = useCallback(() => {
    refreshStats();
  }, [refreshStats]);

  const handleTicketUpdated = useCallback(
    (ticketId: string, patch: Partial<SupportRequestRow>) => {
      setRequests((prev) => {
        const next = prev.map((request) =>
          request._id === ticketId ? { ...request, ...patch } : request,
        );
        if (patch.updatedAt) {
          return [...next].sort(
            (a, b) =>
              new Date(b.updatedAt || b.createdAt).getTime() -
              new Date(a.updatedAt || a.createdAt).getTime(),
          );
        }
        return next;
      });
      setOffPageTicket((prev) => (prev?._id === ticketId ? { ...prev, ...patch } : prev));
      setManageRequest((prev) => (prev?._id === ticketId ? { ...prev, ...patch } : prev));
      refreshStats();
    },
    [refreshStats],
  );

  const activeTicket = useMemo(
    () => (activeTicketId ? requests.find((request) => request._id === activeTicketId) : null),
    [activeTicketId, requests],
  );

  const resolvedActiveTicket = activeTicket ?? offPageTicket;

  const openManageForActiveTicket = useCallback(() => {
    if (resolvedActiveTicket) {
      openManage(resolvedActiveTicket);
      return;
    }
    if (!activeTicketId) return;
    fetch(`/api/support-requests/${activeTicketId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) openManage(data as SupportRequestRow);
      })
      .catch(() => undefined);
  }, [resolvedActiveTicket, activeTicketId, openManage]);

  useEffect(() => {
    if (!activeTicketId) {
      setOffPageTicket(null);
      return;
    }
    if (activeTicket) {
      setOffPageTicket(null);
      return;
    }

    let cancelled = false;
    fetch(`/api/support-requests/${activeTicketId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setOffPageTicket(data as SupportRequestRow);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [activeTicketId, activeTicket]);

  const applyManageUpdate = async (
    request: SupportRequestRow,
    options: { status?: string; closeDialog?: boolean; assignToCurrentAdmin?: boolean } = {},
  ) => {
    setUpdatingId(request._id);
    try {
      const selectedAdmin = assignableAdmins.find((a) => a.id === manageAssigneeId);
      const res = await fetch(`/api/support-requests/${request._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(options.status ? { status: options.status } : {}),
          previousStatus: request.status,
          ...(isSuperAdmin ? { adminNotes: manageNotes } : {}),
          ...(options.assignToCurrentAdmin && currentAdminId
            ? {
                assignedAdminId: currentAdminId,
                assignedAdminName: currentAdminName,
              }
            : isSuperAdmin
            ? {
                assignedAdminId: manageAssigneeId === 'unassigned' ? null : manageAssigneeId,
                assignedAdminName: selectedAdmin?.name || '',
              }
            : {}),
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        const merged = {
          status: updated.status ?? request.status,
          adminNotes: updated.adminNotes ?? request.adminNotes,
          assignedAdminId: updated.assignedAdminId ?? null,
          assignedAdminName: updated.assignedAdminName ?? '',
          pendingResolutionAt: updated.pendingResolutionAt ?? null,
          autoResolveAt: updated.autoResolveAt ?? null,
          message: updated.message ?? request.message,
          subject: updated.subject ?? request.subject,
        };
        setRequests((prev) =>
          prev.map((r) => (r._id === request._id ? { ...r, ...merged } : r)),
        );
        setManageRequest((prev) => (prev?._id === request._id ? { ...prev, ...merged } : prev));
        setOffPageTicket((prev) =>
          prev?._id === request._id ? { ...prev, ...merged } : prev,
        );
        setChatRefreshKey((key) => key + 1);
        refreshStats();
        if (options.closeDialog) setManageRequest(null);
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSaveManage = async () => {
    if (!manageRequest) return;
    if (!isSuperAdmin) {
      setManageRequest(null);
      return;
    }
    await applyManageUpdate(manageRequest, { closeDialog: true });
  };

  const getStatusBadge = (status: string) => {
    const label = SUPPORT_REQUEST_STATUS_LABELS[status] ?? status;
    switch (status) {
      case SUPPORT_REQUEST_STATUS.RESOLVED:
      case SUPPORT_REQUEST_STATUS.CLOSED:
        return (
          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-normal">
            {status === SUPPORT_REQUEST_STATUS.CLOSED ? 'Closed' : label}
          </Badge>
        );
      case SUPPORT_REQUEST_STATUS.IN_PROGRESS:
        return (
          <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
            {label}
          </Badge>
        );
      case SUPPORT_REQUEST_STATUS.PENDING_RESOLUTION:
        return (
          <Badge variant="outline" className="border-blue-500 text-blue-700 dark:text-blue-400">
            {label}
          </Badge>
        );
      case SUPPORT_REQUEST_STATUS.OPEN:
      default:
        return <Badge variant="destructive">{label}</Badge>;
    }
  };

  const categoryOptions = Object.values(SUPPORT_REQUEST_CATEGORY).map((value) => ({
    value,
    label: SUPPORT_REQUEST_CATEGORY_LABELS[value] || value,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Support inbox</h2>
          <p className="text-sm text-muted-foreground">
            Conversations with customers — select a ticket to reply.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="font-normal">
            {pagination.total} tickets
          </Badge>
          {stats.openSupportRequests > 0 && (
            <Badge variant="outline" className="gap-1.5 font-normal">
              <SupportCountBadge count={stats.openSupportRequests} variant="secondary" />
              open
            </Badge>
          )}
          {stats.unreadChatMessages > 0 && (
            <Badge variant="outline" className="gap-1.5 font-normal border-destructive/30">
              <SupportCountBadge count={stats.unreadChatMessages} />
              unread
            </Badge>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleRefreshAll}
            disabled={loading}
          >
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      <SupportInboxShell
        sidebar={
          <div className="flex h-full min-h-0 flex-col">
            <div className="shrink-0 space-y-3 border-b p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search tickets…"
                  className="h-9 pl-9"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={unassignedOnlyFilter ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 w-full text-xs"
                  onClick={() => {
                    setUnassignedOnlyFilter((prev) => !prev);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                >
                  Unassigned
                </Button>
                <Button
                  variant={activeOnlyFilter ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 w-full gap-1.5 text-xs"
                  onClick={() => {
                    setActiveOnlyFilter((prev) => !prev);
                    setStatusFilter('');
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                >
                  <span>Active</span>
                  {stats.openSupportRequests > 0 && (
                    <SupportCountBadge count={stats.openSupportRequests} />
                  )}
                </Button>
                <Select
                  value={statusFilter || 'all'}
                  onValueChange={(value) => {
                    setStatusFilter(value === 'all' ? '' : value);
                    setActiveOnlyFilter(false);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                >
                  <SelectTrigger className="h-8 w-full text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All status</SelectItem>
                    {Object.values(SUPPORT_REQUEST_STATUS).map((s) => (
                      <SelectItem key={s} value={s}>
                        {SUPPORT_REQUEST_STATUS_LABELS[s] ?? s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={categoryFilter || 'all'}
                  onValueChange={(value) => {
                    setCategoryFilter(value === 'all' ? '' : value);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                >
                  <SelectTrigger className="h-8 w-full text-xs">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categoryOptions.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading ? (
                <div className="space-y-2 p-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-[72px] w-full rounded-lg" />
                  ))}
                </div>
              ) : requests.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-16 text-center text-muted-foreground">
                  <Inbox className="mb-3 size-10 opacity-30" />
                  <p className="text-sm font-medium">No tickets found</p>
                  <p className="mt-1 text-xs">Try clearing filters or search by ticket ID.</p>
                </div>
              ) : (
                <ul className="divide-y">
                  {requests.map((request) => {
                    const isHighlighted = highlightRequestId === request._id;
                    const isSelected = activeTicketId === request._id;
                    const unread = (request.unreadByAdmin ?? 0) > 0;

                    return (
                      <li
                        key={request._id}
                        className={cn(
                          'flex items-stretch',
                          isSelected && 'border-l-2 border-l-primary bg-primary/8',
                          isHighlighted && !highlightFading && 'bg-amber-50 dark:bg-amber-950/20',
                        )}
                      >
                        <button
                          type="button"
                          ref={isHighlighted ? highlightedRowRef : null}
                          onClick={() => selectTicket(request._id)}
                          className={cn(
                            'min-w-0 flex-1 px-3 py-3 text-left transition-colors hover:bg-muted/60',
                            isSelected && 'hover:bg-primary/10',
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                              {getCompanyName(request).slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className="truncate text-sm font-medium">{request.subject}</p>
                                <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                                  {formatQueueDate(request.updatedAt || request.createdAt)}
                                </span>
                              </div>
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {getCompanyName(request)} · {formatUser(request.userId)}
                              </p>
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                <span className="font-mono text-[10px] text-muted-foreground">
                                  {getTicketReferenceId(request)}
                                </span>
                                {getStatusBadge(request.status)}
                                {unread && (
                                  <SupportCountBadge count={request.unreadByAdmin ?? 0} />
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                        <div className="flex shrink-0 items-start pt-2 pr-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            title="Manage ticket"
                            onClick={() => openManage(request)}
                          >
                            <Settings2 className="size-3.5" />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {pagination.total > 0 && (
              <div className="flex shrink-0 flex-col gap-2 border-t px-3 py-2">
                <p className="text-[11px] text-muted-foreground">
                  {paginationRange
                    ? `Showing ${paginationRange.start}–${paginationRange.end} of ${pagination.total}`
                    : `${pagination.total} tickets`}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <Select
                    value={pagination.limit.toString()}
                    onValueChange={(value) => {
                      setPagination((prev) => ({
                        ...prev,
                        limit: parseInt(value, 10),
                        page: 1,
                      }));
                    }}
                  >
                    <SelectTrigger className="h-7 w-[4.5rem] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {pagination.page}/{Math.max(pagination.pages, 1)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page === 1}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page >= pagination.pages}
                      aria-label="Next page"
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        }
        main={
          <>
            {activeTicketId && !activeTicket && !loading && (
              <div className="shrink-0 border-b bg-amber-50/80 px-4 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                This ticket is not on the current page — conversation is still available below.
              </div>
            )}
            {activeTicketId ? (
              <TicketChatPanel
                key={activeTicketId}
                requestId={activeTicketId}
                referenceId={
                  resolvedActiveTicket ? getTicketReferenceId(resolvedActiveTicket) : undefined
                }
                subject={resolvedActiveTicket?.subject}
                companyName={resolvedActiveTicket ? getCompanyName(resolvedActiveTicket) : undefined}
                userName={resolvedActiveTicket ? formatUser(resolvedActiveTicket.userId) : undefined}
                adminNotes={resolvedActiveTicket?.adminNotes}
                initialMessage={resolvedActiveTicket?.message}
                currentAdminId={currentAdminId}
                currentAdminName={currentAdminName}
                onActivity={handleChatActivity}
                onTicketLoaded={(ticket) => {
                  if (!activeTicketId) return;
                  handleTicketUpdated(activeTicketId, {
                    status: ticket.status,
                    adminNotes: ticket.adminNotes,
                    subject: ticket.subject,
                    message: ticket.message,
                    unreadByAdmin: ticket.unreadByAdmin,
                    assignedAdminId: ticket.assignedAdminId,
                    assignedAdminName: ticket.assignedAdminName,
                    updatedAt: ticket.updatedAt,
                  });
                }}
                onOpenManage={openManageForActiveTicket}
                refreshKey={chatRefreshKey}
                className="h-full min-h-0"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
                <Inbox className="size-12 opacity-25" />
                <div>
                  <p className="font-medium text-foreground">No ticket selected</p>
                  <p className="mt-1 max-w-sm text-sm">
                    {loading ? 'Loading tickets…' : 'Choose a conversation from the list to start replying.'}
                  </p>
                </div>
              </div>
            )}
          </>
        }
      />

      <Dialog
        open={!!manageRequest}
        onOpenChange={(open) => !open && setManageRequest(null)}
      >
        <DialogContent className="flex max-h-[min(90vh,720px)] max-w-lg flex-col gap-0 overflow-hidden p-0">
          {manageRequest && (
            <>
              <DialogHeader className="space-y-1 border-b px-6 py-4 text-left">
                <DialogTitle className="pr-8 leading-snug">{manageRequest.subject}</DialogTitle>
                <DialogDescription>
                  {getTicketReferenceId(manageRequest)} ·{' '}
                  {SUPPORT_REQUEST_CATEGORY_LABELS[manageRequest.category]} ·{' '}
                  {getCompanyName(manageRequest)}
                </DialogDescription>
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <div className="space-y-6 px-6 py-4">
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div className="space-y-1">
                      <dt className="text-muted-foreground">Submitted by</dt>
                      <dd className="font-medium">{formatUser(manageRequest.userId)}</dd>
                    </div>
                    <div className="space-y-1">
                      <dt className="text-muted-foreground">Submitted</dt>
                      <dd>{new Date(manageRequest.createdAt).toLocaleString()}</dd>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <dt className="text-muted-foreground">Status</dt>
                      <dd>{getStatusBadge(manageRequest.status)}</dd>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <dt className="text-muted-foreground">Assigned to</dt>
                      <dd className="font-medium">
                        {manageRequest.assignedAdminName?.trim() || 'Unassigned'}
                      </dd>
                    </div>
                  </dl>

                  <Separator />

                  <div className="space-y-2">
                    <Label>Customer message</Label>
                    <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {manageRequest.message?.trim() ? (
                        manageRequest.message
                      ) : (
                        <span className="text-muted-foreground italic">
                          No description stored — check the conversation for messages.
                        </span>
                      )}
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label>Ticket history</Label>
                      <p className="text-xs text-muted-foreground">
                        Read-only audit trail — who changed the ticket and when.
                      </p>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <TicketStatusTimeline
                        entries={manageStatusTimeline}
                        loading={loadingManageTimeline}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor={isSuperAdmin ? 'manage-notes' : undefined}>
                      Private team notes
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {isSuperAdmin
                        ? 'Internal only — not visible to the customer. Only super admins can add or edit these notes.'
                        : 'Internal only — not visible to the customer. Read-only for admins.'}
                    </p>
                    {isSuperAdmin ? (
                      <Textarea
                        id="manage-notes"
                        rows={4}
                        placeholder="Add context for other admins (billing details, steps taken, escalation notes…)"
                        value={manageNotes}
                        onChange={(e) => setManageNotes(e.target.value)}
                        disabled={updatingId === manageRequest._id}
                        className="min-h-[100px] resize-y"
                      />
                    ) : manageNotes.trim() ? (
                      <div className="rounded-md border border-amber-200/80 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/20 p-3 text-sm whitespace-pre-wrap max-h-40 overflow-y-auto">
                        {manageNotes}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic rounded-md border border-dashed bg-muted/20 px-3 py-4 text-center">
                        No private notes yet.
                      </p>
                    )}
                  </div>

                  {isSuperAdmin ? (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <Label htmlFor="manage-assignee">Assigned admin</Label>
                        <Select
                          value={manageAssigneeId || 'unassigned'}
                          onValueChange={setManageAssigneeId}
                          disabled={updatingId === manageRequest._id}
                        >
                          <SelectTrigger id="manage-assignee">
                            <SelectValue placeholder="Unassigned" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {assignableAdmins.map((admin) => (
                              <SelectItem key={admin.id} value={admin.id}>
                                {admin.name}
                                {admin.isSuperAdmin ? ' (Super admin)' : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  ) : null}

                  <Separator />

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label>Quick actions</Label>
                      <p className="text-xs text-muted-foreground">
                        Customers are notified automatically when the ticket status changes.
                      </p>
                    </div>
                    {manageRequest.status === SUPPORT_REQUEST_STATUS.PENDING_RESOLUTION && (
                      <p className="text-xs text-muted-foreground rounded-md border bg-blue-50 px-3 py-2 dark:bg-blue-950/20">
                        Waiting for the customer to confirm resolution. Auto-closes after 7 days
                        without a response.
                      </p>
                    )}
                    {(manageRequest.status === SUPPORT_REQUEST_STATUS.RESOLVED ||
                      manageRequest.status === SUPPORT_REQUEST_STATUS.CLOSED) && (
                      <p className="text-xs text-muted-foreground rounded-md border bg-muted/40 px-3 py-2">
                        This ticket was resolved and cannot be reopened.
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {manageRequest.status === SUPPORT_REQUEST_STATUS.OPEN &&
                        !isTicketAssigned(manageRequest) && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={updatingId === manageRequest._id || !currentAdminId}
                          onClick={() =>
                            applyManageUpdate(manageRequest, {
                              status: SUPPORT_REQUEST_STATUS.IN_PROGRESS,
                              assignToCurrentAdmin: true,
                            })
                          }
                        >
                          Take ticket
                        </Button>
                      )}
                      {manageRequest.status === SUPPORT_REQUEST_STATUS.OPEN &&
                        isAssignedToAdmin(manageRequest, currentAdminId) && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={updatingId === manageRequest._id}
                          onClick={() =>
                            applyManageUpdate(manageRequest, {
                              status: SUPPORT_REQUEST_STATUS.IN_PROGRESS,
                            })
                          }
                        >
                          Start working
                        </Button>
                      )}
                      {(manageRequest.status === SUPPORT_REQUEST_STATUS.OPEN ||
                        manageRequest.status === SUPPORT_REQUEST_STATUS.IN_PROGRESS) && (
                        <Button
                          type="button"
                          size="sm"
                          disabled={updatingId === manageRequest._id}
                          onClick={() =>
                            applyManageUpdate(manageRequest, {
                              status: SUPPORT_REQUEST_STATUS.RESOLVED,
                              closeDialog: true,
                            })
                          }
                        >
                          Close ticket
                        </Button>
                      )}
                      {manageRequest.status === SUPPORT_REQUEST_STATUS.PENDING_RESOLUTION && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={updatingId === manageRequest._id}
                          onClick={() =>
                            applyManageUpdate(manageRequest, {
                              status: SUPPORT_REQUEST_STATUS.IN_PROGRESS,
                            })
                          }
                        >
                          Reopen ticket
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2 border-t px-6 py-4 sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    selectTicket(manageRequest._id);
                    setManageRequest(null);
                  }}
                >
                  <MessageCircle className="size-4" />
                  Open chat
                </Button>
                <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
                  <Button variant="outline" onClick={() => setManageRequest(null)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveManage}
                    disabled={updatingId === manageRequest._id}
                  >
                    {updatingId === manageRequest._id ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Saving…
                      </>
                    ) : isSuperAdmin ? (
                      'Save changes'
                    ) : (
                      'Done'
                    )}
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
