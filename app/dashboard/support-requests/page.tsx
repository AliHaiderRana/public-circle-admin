'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  Clock,
  User,
  RefreshCw,
} from 'lucide-react';
import { useSupportStats } from '@/hooks/use-support-stats';
import { SupportCountBadge } from '@/components/SupportCountBadge';
import { TicketChatPanel } from '@/components/TicketChatPanel';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { formatAdminDisplayName, formatSupportReferenceId } from '@/lib/support-admin.util';

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

function formatAssigneeName(name?: string | null) {
  return formatAdminDisplayName(name, null);
}

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

export default function SupportRequestsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const currentAdminId = user?.id ? String(user.id) : undefined;
  const currentAdminName = formatAdminDisplayName(user?.name, user?.email);
  const highlightRequestId = searchParams.get('highlight');
  const activeTicketId = searchParams.get('ticket');
  const { stats, refresh: refreshStats } = useSupportStats();
  const highlightedRowRef = useRef<HTMLTableRowElement>(null);

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
  const [manageNotes, setManageNotes] = useState('');
  const [manageAssigneeId, setManageAssigneeId] = useState('');
  const [assignableAdmins, setAssignableAdmins] = useState<AssignableAdmin[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  });
  const [chatRefreshKey, setChatRefreshKey] = useState(0);
  const [offPageTicket, setOffPageTicket] = useState<SupportRequestRow | null>(null);

  const openManage = useCallback((request: SupportRequestRow) => {
    setManageRequest(request);
    setManageNotes(request.adminNotes ?? '');
    setManageAssigneeId(request.assignedAdminId ? String(request.assignedAdminId) : 'unassigned');
  }, []);

  useEffect(() => {
    fetch('/api/support/assignable-admins')
      .then((res) => (res.ok ? res.json() : { admins: [] }))
      .then((data) => setAssignableAdmins(data.admins ?? []))
      .catch(() => setAssignableAdmins([]));
  }, []);

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

  const handleChatActivity = useCallback(() => {
    refreshStats();
    if (activeTicketId) {
      setRequests((prev) =>
        prev.map((request) =>
          request._id === activeTicketId ? { ...request, unreadByAdmin: 0 } : request,
        ),
      );
    }
  }, [refreshStats, activeTicketId]);

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
    options: { status?: string; closeDialog?: boolean } = {},
  ) => {
    setUpdatingId(request._id);
    try {
      const selectedAdmin = assignableAdmins.find((a) => a.id === manageAssigneeId);
      const res = await fetch(`/api/support-requests/${request._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(options.status ? { status: options.status } : {}),
          adminNotes: manageNotes,
          previousStatus: request.status,
          assignedAdminId: manageAssigneeId === 'unassigned' ? null : manageAssigneeId,
          assignedAdminName: selectedAdmin?.name || '',
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        const merged = {
          status: updated.status ?? request.status,
          adminNotes: updated.adminNotes ?? manageNotes,
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
        setManageNotes(merged.adminNotes ?? '');
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

  const activeOnPage = requests.filter((r) => isActiveStatus(r.status)).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Support Requests</h2>
          <p className="text-muted-foreground text-sm max-w-xl">
            Pick a ticket to chat on the right. Use filters or search by ticket ID to find resolved
            tickets.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Card className="shadow-none border-dashed min-w-[140px]">
            <CardContent className="flex items-center gap-3 p-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                <Inbox className="size-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-xl font-semibold tabular-nums">{pagination.total}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-none border-dashed min-w-[160px]">
            <CardContent className="flex items-center gap-3 p-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                <Clock className="size-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Open & in progress</p>
                <div className="flex items-center gap-2">
                  {stats.openSupportRequests > 0 ? (
                    <SupportCountBadge
                      count={stats.openSupportRequests}
                      className="min-h-7 min-w-7 px-2 text-xs"
                    />
                  ) : (
                    <p className="text-xl font-semibold tabular-nums">0</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-none border-dashed min-w-[160px]">
            <CardContent className="flex items-center gap-3 p-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-destructive/10">
                <MessageCircle className="size-4 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Unread messages</p>
                <div className="flex items-center gap-2">
                  {stats.unreadChatMessages > 0 ? (
                    <SupportCountBadge
                      count={stats.unreadChatMessages}
                      className="min-h-7 min-w-7 px-2 text-xs"
                    />
                  ) : (
                    <p className="text-xl font-semibold tabular-nums">0</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          {(stats as { unassignedTickets?: number }).unassignedTickets ? (
            <Card className="shadow-none border-dashed min-w-[160px]">
              <CardContent className="flex items-center gap-3 p-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500/10">
                  <User className="size-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Unassigned</p>
                  <p className="text-xl font-semibold tabular-nums">
                    {(stats as { unassignedTickets?: number }).unassignedTickets}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_420px] xl:grid-cols-[1fr_460px] lg:items-start">
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <CardTitle>Request queue</CardTitle>
              <CardDescription>
                {loading
                  ? 'Loading requests...'
                  : pagination.total > 0
                    ? `Showing ${requests.length} of ${pagination.total} requests`
                    : 'No requests match your filters.'}
                {activeOnPage > 0 && !statusFilter && !activeOnlyFilter && (
                  <> · {activeOnPage} active on this page</>
                )}
              </CardDescription>
            </div>
            <div className="flex w-full items-center gap-2 lg:w-auto">
              <div className="relative flex-1 lg:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
              <Input
                placeholder="Search ticket ID, company, subject..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
              />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-2"
                onClick={handleRefreshAll}
                disabled={loading}
              >
                <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
                Refresh
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-4 border-t">
            <Button
              variant={unassignedOnlyFilter ? 'default' : 'outline'}
              size="sm"
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
              onClick={() => {
                setActiveOnlyFilter((prev) => !prev);
                setStatusFilter('');
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            >
              Needs attention
              {stats.openSupportRequests > 0 && (
                <SupportCountBadge count={stats.openSupportRequests} className="ml-1.5" />
              )}
            </Button>
            <Select
              value={categoryFilter || 'all'}
              onValueChange={(value) => {
                setCategoryFilter(value === 'all' ? '' : value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            >
              <SelectTrigger className="w-48 h-8">
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
            <Select
              value={statusFilter || 'all'}
              onValueChange={(value) => {
                setStatusFilter(value === 'all' ? '' : value);
                setActiveOnlyFilter(false);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            >
              <SelectTrigger className="w-40 h-8">
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
            {(searchTerm || statusFilter || activeOnlyFilter || unassignedOnlyFilter || categoryFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('');
                  setActiveOnlyFilter(false);
                  setUnassignedOnlyFilter(false);
                  setCategoryFilter('');
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6 w-[38%]">Request</TableHead>
                <TableHead className="w-[22%]">Customer</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="whitespace-nowrap">Updated</TableHead>
                <TableHead className="text-right pr-6 w-[88px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j} className={j === 0 ? 'pl-6' : j === 5 ? 'pr-6' : ''}>
                        <Skeleton className="h-4 w-full max-w-[120px]" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-48 text-muted-foreground">
                    <Inbox className="size-10 mx-auto mb-3 opacity-30" />
                    <p>No support requests found.</p>
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((request) => {
                  const isHighlighted = highlightRequestId === request._id;
                  const isSelected = activeTicketId === request._id;
                  const unread = (request.unreadByAdmin ?? 0) > 0;

                  return (
                    <TableRow
                      key={request._id}
                      ref={isHighlighted ? highlightedRowRef : null}
                      onClick={() => selectTicket(request._id)}
                      className={cn(
                        'cursor-pointer transition-colors border-l-2 border-l-transparent',
                        isSelected && 'bg-primary/5 hover:bg-primary/5 border-l-primary',
                        isHighlighted && !highlightFading && 'bg-amber-50 dark:bg-amber-950/20',
                      )}
                    >
                      <TableCell className="pl-6 py-3">
                        <div className="flex items-start gap-2 min-w-0">
                          {unread && (
                            <SupportCountBadge
                              count={request.unreadByAdmin ?? 0}
                              className="shrink-0 mt-0.5"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate" title={request.subject}>
                              {request.subject}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                              <span className="font-mono text-[11px] text-muted-foreground">
                                {getTicketReferenceId(request)}
                              </span>
                              <span className="text-muted-foreground/40">·</span>
                              <span className="text-[11px] text-muted-foreground truncate">
                                {SUPPORT_REQUEST_CATEGORY_LABELS[request.category] || request.category}
                              </span>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate" title={getCompanyName(request)}>
                            {getCompanyName(request)}
                          </p>
                          <p
                            className="text-xs text-muted-foreground truncate mt-0.5"
                            title={formatUser(request.userId)}
                          >
                            {formatUser(request.userId)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-sm">
                        {request.assignedAdminName ? (
                          <span className="truncate block max-w-[100px]" title={request.assignedAdminName}>
                            {formatAssigneeName(request.assignedAdminName)}
                          </span>
                        ) : (
                          <Badge
                            variant="outline"
                            className="font-normal text-amber-700 border-amber-400/80 text-[11px]"
                          >
                            Unassigned
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-3">{getStatusBadge(request.status)}</TableCell>
                      <TableCell
                        className="py-3 text-xs text-muted-foreground whitespace-nowrap tabular-nums"
                        title={new Date(request.updatedAt || request.createdAt).toLocaleString()}
                      >
                        {formatQueueDate(request.updatedAt || request.createdAt)}
                      </TableCell>
                      <TableCell className="text-right pr-4 py-3">
                        <div className="flex justify-end gap-0.5">
                          <Button
                            variant={isSelected ? 'secondary' : 'ghost'}
                            size="icon"
                            className="size-8"
                            title="Open chat"
                            onClick={(event) => {
                              event.stopPropagation();
                              selectTicket(request._id);
                            }}
                          >
                            <MessageCircle className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            title="Manage ticket"
                            onClick={(event) => {
                              event.stopPropagation();
                              openManage(request);
                            }}
                          >
                            <Settings2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.pages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                >
                  <ChevronLeft className="size-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page === pagination.pages}
                >
                  Next
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="lg:sticky lg:top-20">
        {activeTicketId && !activeTicket && !loading && (
          <div className="mb-2 rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Ticket not on this page — chat history is still loaded. Clear filters or search by ticket
            ID.
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
            onOpenManage={openManageForActiveTicket}
            refreshKey={chatRefreshKey}
            className="h-[calc(100vh-14rem)] min-h-[520px]"
          />
        ) : (
          <Card className="flex h-[calc(100vh-14rem)] min-h-[520px] flex-col items-center justify-center border-dashed bg-muted/10 shadow-none">
            <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-muted">
                <MessageCircle className="size-7 text-muted-foreground/50" />
              </div>
              <div className="space-y-1.5 max-w-[260px]">
                <p className="font-medium">Select a ticket</p>
                <p className="text-sm text-muted-foreground">
                  Click any row to open its conversation here, or use the chat icon on a row.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      </div>

      <Dialog
        open={!!manageRequest}
        onOpenChange={(open) => !open && setManageRequest(null)}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {manageRequest && (
            <>
              <DialogHeader>
                <DialogTitle>{manageRequest.subject}</DialogTitle>
                <DialogDescription>
                  {getTicketReferenceId(manageRequest)} ·{' '}
                  {SUPPORT_REQUEST_CATEGORY_LABELS[manageRequest.category]} ·{' '}
                  {getCompanyName(manageRequest)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Submitted by</span>
                    <span className="font-medium text-right">
                      {formatUser(manageRequest.userId)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Submitted</span>
                    <span>{new Date(manageRequest.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Current status</span>
                    {getStatusBadge(manageRequest.status)}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Customer message</Label>
                  <div className="rounded-md border bg-background p-3 text-sm whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {manageRequest.message?.trim() ? (
                      manageRequest.message
                    ) : (
                      <span className="text-muted-foreground italic">
                        No description stored — check the conversation panel for messages.
                      </span>
                    )}
                  </div>
                </div>

                {manageRequest.adminNotes?.trim() ? (
                  <div className="space-y-2">
                    <Label>Saved internal notes</Label>
                    <div className="rounded-md border border-amber-200/80 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/20 p-3 text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {manageRequest.adminNotes}
                    </div>
                  </div>
                ) : null}

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

                <div className="space-y-3">
                  <Label>Status</Label>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(manageRequest.status)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Customers are notified automatically when the ticket status changes.
                  </p>
                  {manageRequest.status === SUPPORT_REQUEST_STATUS.PENDING_RESOLUTION && (
                    <p className="text-xs text-muted-foreground rounded-md border bg-blue-50 dark:bg-blue-950/20 px-3 py-2">
                      Waiting for the customer to confirm this ticket is resolved. It will close
                      automatically after 7 days if they do not respond.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {manageRequest.status === SUPPORT_REQUEST_STATUS.OPEN && (
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
                        Take ticket
                      </Button>
                    )}
                    {(manageRequest.status === SUPPORT_REQUEST_STATUS.OPEN ||
                      manageRequest.status === SUPPORT_REQUEST_STATUS.IN_PROGRESS) && (
                      <Button
                        type="button"
                        variant="default"
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
                    {(manageRequest.status === SUPPORT_REQUEST_STATUS.PENDING_RESOLUTION ||
                      manageRequest.status === SUPPORT_REQUEST_STATUS.RESOLVED ||
                      manageRequest.status === SUPPORT_REQUEST_STATUS.CLOSED) && (
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

                <div className="space-y-2">
                  <Label htmlFor="manage-notes">Internal notes (optional)</Label>
                  <Textarea
                    id="manage-notes"
                    placeholder="Notes for your team — not visible to the customer"
                    value={manageNotes}
                    onChange={(e) => setManageNotes(e.target.value)}
                    rows={3}
                    disabled={updatingId === manageRequest._id}
                  />
                </div>
              </div>

              <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
                <Button
                  variant="outline"
                  onClick={() => {
                    selectTicket(manageRequest._id);
                    setManageRequest(null);
                  }}
                >
                  <MessageCircle className="size-4" />
                  Open chat
                </Button>
                <div className="flex gap-2 w-full sm:w-auto justify-end">
                  <Button variant="ghost" onClick={() => setManageRequest(null)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveManage}
                    disabled={updatingId === manageRequest._id}
                  >
                    {updatingId === manageRequest._id ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save assignment & notes'
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
