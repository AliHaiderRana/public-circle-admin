'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Button, buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Separator } from '@/components/ui/separator';
import {
  ADMIN_NOTIFICATION_TYPES,
  SUPPORT_REQUEST_STATUS,
  SUPPORT_REQUEST_CATEGORY,
  SUPPORT_REQUEST_CATEGORY_LABELS,
  SUPPORT_REQUEST_STATUS_LABELS,
} from '@/lib/constants';
import {
  Loader2,
  MessageCircle,
  Inbox,
  Settings2,
  RefreshCw,
  Trash2,
  Info,
  AlertCircle,
} from 'lucide-react';
import { useSupportStats } from '@/hooks/use-support-stats';
import { SupportCountBadge } from '@/components/SupportCountBadge';
import { TicketChatPanel } from '@/components/TicketChatPanel';
import { SupportInboxShell } from '@/components/support/SupportInboxShell';
import { SupportInboxFilters } from '@/components/support/SupportInboxFilters';
import {
  AssigneeSelectOptions,
  assigneeSelectContentClassName,
  formatReferralPartnerRole,
  resolveAssigneeDisplayName,
} from '@/components/support/AssigneeSelectOptions';
import { TicketStatusTimeline } from '@/components/support/TicketStatusTimeline';
import {
  ConfirmToggleDialog,
  type ConfirmToggleRequest,
} from '@/components/ConfirmToggleDialog';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { formatAdminDisplayName, formatSupportReferenceId } from '@/lib/support-admin.util';
import { getSupportSocket, subscribeSupportChatMessage } from '@/lib/support-socket';
import {
  subscribeAdminNotifications,
  subscribeAdminSupportTicketStatus,
} from '@/lib/admin-notification-socket';
import { patchSupportInboxTicketList, sortSupportInboxTickets } from '@/lib/support-inbox-list.util';
import {
  broadcastAdminSupportTabEvent,
  subscribeAdminSupportTabSync,
} from '@/lib/support-tab-sync';
import {
  buildTicketHistoryForAdmin,
  type StatusTimelineEntry,
  type SupportAuditTrailEntry,
} from '@/lib/support-status-timeline.util';
import type { AssignmentHistoryEntry } from '@/lib/support-assignment.util';
import {
  formatSupportTicketCustomerName,
  getSupportTicketAvatarInitials,
  getSupportTicketPreviewText,
  getSupportTicketSubjectTitle,
} from '@/lib/support-ticket-display.util';

type LinkedReferralPartner = {
  id: string;
  email: string;
  name: string;
  role: 'SALES_PERSON' | 'MARKETING_AFFILIATE';
};

type SupportRequestRow = {
  _id: string;
  referenceId?: string;
  category: string;
  subject: string;
  message: string;
  lastMessagePreview?: string;
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
  linkedReferralPartners?: LinkedReferralPartner[];
};

function formatReferralPartnersSummary(partners: LinkedReferralPartner[] | undefined) {
  if (!partners?.length) return null;
  return partners
    .map((partner) => `${partner.name} (${formatReferralPartnerRole(partner.role)})`)
    .join(' · ');
}

function pickAutoReferralAssignee(partners: LinkedReferralPartner[] | undefined): string | null {
  if (!partners?.length) return null;
  const salesPartner = partners.find((partner) => partner.role === 'SALES_PERSON');
  if (salesPartner) return salesPartner.id;
  return partners[0]?.id ?? null;
}

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
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const currentAdminId = user?.id ? String(user.id) : undefined;
  const currentAdminName = formatAdminDisplayName(user?.name, user?.email);
  const isSuperAdmin = Boolean(user?.isSuperAdmin);
  const isPartner = Boolean(user?.isPartner);
  const highlightRequestId = searchParams.get('highlight');
  const selectedTicketId = searchParams.get('ticket');
  const { stats, refresh: refreshStats } = useSupportStats();
  const highlightedRowRef = useRef<HTMLButtonElement>(null);
  const resolvedActiveTicketRef = useRef<SupportRequestRow | null>(null);
  const silentRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightHandledRef = useRef<string | null>(null);
  const highlightClearAttemptedRef = useRef(false);
  const superAdminInboxInitializedRef = useRef(false);
  const selectedTicketIdRef = useRef<string | null>(selectedTicketId);
  selectedTicketIdRef.current = selectedTicketId;

  const [ticketCloseConfirm, setTicketCloseConfirm] = useState<{
    ticket: SupportRequestRow;
    mode: 'request_confirmation' | 'force_resolve';
  } | null>(null);

  const updateTicketInUrl = useCallback(
    (ticketId: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (ticketId) {
        params.set('ticket', ticketId);
      } else {
        params.delete('ticket');
      }
      const qs = params.toString();
      const nextUrl = qs ? `${pathname}?${qs}` : pathname;
      const currentTicket = searchParams.get('ticket');
      if ((currentTicket || null) === (ticketId || null)) return;
      router.replace(nextUrl, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const selectTicket = useCallback(
    (ticketId: string | null) => {
      if (ticketId) {
        setRequests((prev) => {
          const target = prev.find((request) => request._id === ticketId);
          if (!target || (target.unreadByAdmin ?? 0) === 0) return prev;
          return prev.map((request) =>
            request._id === ticketId ? { ...request, unreadByAdmin: 0 } : request,
          );
        });
        setOffPageTicket((prev) =>
          prev?._id === ticketId && (prev.unreadByAdmin ?? 0) > 0
            ? { ...prev, unreadByAdmin: 0 }
            : prev,
        );
      }
      updateTicketInUrl(ticketId);
    },
    [updateTicketInUrl],
  );

  const [requests, setRequests] = useState<SupportRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [activeOnlyFilter, setActiveOnlyFilter] = useState(false);
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
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
  const [manageAssignmentHistory, setManageAssignmentHistory] = useState<AssignmentHistoryEntry[]>(
    [],
  );
  const [manageAuditTrail, setManageAuditTrail] = useState<SupportAuditTrailEntry[]>([]);
  const [manageOriginalAssigneeId, setManageOriginalAssigneeId] = useState('unassigned');
  const [manageLinkedPartners, setManageLinkedPartners] = useState<LinkedReferralPartner[]>([]);
  const [chatAnchorMessageId, setChatAnchorMessageId] = useState<string | null>(null);
  const [manageSaveError, setManageSaveError] = useState('');
  const [manageDeleteConfirmOpen, setManageDeleteConfirmOpen] = useState(false);
  const [deletingTicketId, setDeletingTicketId] = useState<string | null>(null);

  const openManage = useCallback((request: SupportRequestRow) => {
    setManageRequest(request);
    setManageNotes(request.adminNotes ?? '');
    const assigneeId = request.assignedAdminId ? String(request.assignedAdminId) : 'unassigned';
    setManageAssigneeId(assigneeId);
    setManageOriginalAssigneeId(assigneeId);
    setManageSaveError('');
    setManageStatusTimeline([]);
    setManageAssignmentHistory([]);
    setManageAuditTrail([]);
  }, []);

  const manageRequestId = manageRequest?._id ?? '';
  const manageRequestStatus = manageRequest?.status ?? '';
  const manageRequestUpdatedAt = manageRequest?.updatedAt ?? '';

  const manageTicketHistory = useMemo(
    () => buildTicketHistoryForAdmin(manageStatusTimeline, manageAssignmentHistory, manageAuditTrail),
    [manageStatusTimeline, manageAssignmentHistory, manageAuditTrail],
  );

  useEffect(() => {
    if (!manageRequestId) {
      setManageStatusTimeline([]);
      setManageAssignmentHistory([]);
      setManageAuditTrail([]);
      setManageLinkedPartners([]);
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
        if (Array.isArray(data.assignmentHistory)) {
          setManageAssignmentHistory(data.assignmentHistory);
        }
        if (Array.isArray(data.auditTrail)) {
          setManageAuditTrail(data.auditTrail);
        } else {
          setManageAuditTrail([]);
        }
        if (Array.isArray(data.linkedReferralPartners)) {
          setManageLinkedPartners(data.linkedReferralPartners);
        } else {
          setManageLinkedPartners([]);
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
    if (isPartner) {
      setActiveOnlyFilter(false);
      setAssignableAdmins([]);
      return;
    }
    fetch('/api/support/assignable-admins')
      .then((res) => (res.ok ? res.json() : { admins: [] }))
      .then((data) => setAssignableAdmins(data.admins ?? []))
      .catch(() => setAssignableAdmins([]));
  }, [isPartner]);

  useEffect(() => {
    if (!isSuperAdmin || isPartner || superAdminInboxInitializedRef.current) return;
    superAdminInboxInitializedRef.current = true;
    setAssigneeFilter('all');
    setActiveOnlyFilter(false);
    setStatusFilter('');
    setCategoryFilter('');
    setSearchTerm('');
  }, [isSuperAdmin, isPartner]);

  const fetchRequests = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(!isPartner && activeOnlyFilter
          ? { activeOnly: 'true' }
          : statusFilter
            ? { status: statusFilter }
            : {}),
        ...(assigneeFilter === 'unassigned' ? { unassignedOnly: 'true' } : {}),
        ...(assigneeFilter === 'me' && currentAdminId
          ? { assignedAdminId: currentAdminId }
          : {}),
        ...(assigneeFilter !== 'all' &&
        assigneeFilter !== 'unassigned' &&
        assigneeFilter !== 'me'
          ? { assignedAdminId: assigneeFilter }
          : {}),
        ...(categoryFilter && { category: categoryFilter }),
      });

      const res = await fetch(`/api/support-requests?${params}`);
      const data = await res.json();

      if (data.requests) {
        let nextRequests = data.requests as SupportRequestRow[];
        const selectedId = selectedTicketIdRef.current;
        if (isPartner && selectedId) {
          const stillListed = nextRequests.some((request) => request._id === selectedId);
          if (!stillListed) {
            updateTicketInUrl(null);
          }
        }
        setRequests(nextRequests);
        setPagination(data.pagination);
      } else {
        setRequests([]);
      }
    } catch {
      if (!silent) {
        setRequests([]);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [
    pagination.page,
    pagination.limit,
    searchTerm,
    statusFilter,
    activeOnlyFilter,
    assigneeFilter,
    categoryFilter,
    currentAdminId,
    isPartner,
    updateTicketInUrl,
  ]);

  const scheduleSilentRefresh = useCallback(() => {
    if (silentRefreshTimerRef.current) {
      clearTimeout(silentRefreshTimerRef.current);
    }
    silentRefreshTimerRef.current = setTimeout(() => {
      void fetchRequests(true);
      void refreshStats();
    }, 350);
  }, [fetchRequests, refreshStats]);

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
    if (selectedTicketId) {
      setChatRefreshKey((key) => key + 1);
    }
  }, [fetchRequests, refreshStats, selectedTicketId]);

  const patchTicketInLists = useCallback(
    (
      ticketId: string,
      patch: {
        status?: string;
        pendingResolutionAt?: string | null;
        autoResolveAt?: string | null;
        updatedAt?: string;
        unreadByAdmin?: number;
        lastMessagePreview?: string;
      },
      options: { reorder?: boolean } = {},
    ) => {
      const merge = (row: SupportRequestRow) =>
        row._id === ticketId ? { ...row, ...patch } : row;

      setRequests((prev) => {
        const next = prev.map(merge);
        if (!options.reorder) return next;
        const updated = next.find((row) => row._id === ticketId);
        if (!updated) return next;
        return sortSupportInboxTickets(next);
      });
      setOffPageTicket((prev) => (prev?._id === ticketId ? { ...prev, ...patch } : prev));
      setManageRequest((prev) => (prev?._id === ticketId ? { ...prev, ...patch } : prev));
    },
    [],
  );

  const applyChatEventToInboxList = useCallback(
    (
      supportRequestId: string,
      message: {
        senderType: string;
        message: string;
        createdAt: string;
        attachment?: { viewUrl?: string; s3Path?: string } | null;
      },
    ) => {
      let found = false;
      setRequests((prev) => {
        const result = patchSupportInboxTicketList(prev, supportRequestId, message, {
          selectedTicketId: selectedTicketIdRef.current,
        });
        found = result.found;
        return result.tickets;
      });
      if (!found) {
        scheduleSilentRefresh();
      } else {
        void refreshStats();
      }
    },
    [scheduleSilentRefresh, refreshStats],
  );

  useEffect(() => {
    let unsubscribeSocket: (() => void) | undefined;

    const handleTicketStatus = (payload: {
      supportRequestId: string;
      status: string;
      pendingResolutionAt?: string | null;
      autoResolveAt?: string | null;
    }) => {
      patchTicketInLists(
        payload.supportRequestId,
        {
          status: payload.status,
          pendingResolutionAt: payload.pendingResolutionAt ?? null,
          autoResolveAt: payload.autoResolveAt ?? null,
          updatedAt: new Date().toISOString(),
        },
        { reorder: true },
      );
      void refreshStats();
    };

    const unsubscribeStatus = subscribeAdminSupportTicketStatus(handleTicketStatus);

    const unsubscribeNotifications = subscribeAdminNotifications((notification) => {
      if (
        notification.type === ADMIN_NOTIFICATION_TYPES.SUPPORT_REQUEST_CREATED ||
        notification.type === ADMIN_NOTIFICATION_TYPES.SUPPORT_CHAT_CUSTOMER_MESSAGE
      ) {
        scheduleSilentRefresh();
      }
    });

    void (async () => {
      const activeSocket = await getSupportSocket();
      if (!activeSocket) return;

      unsubscribeSocket = subscribeSupportChatMessage(activeSocket, (payload) => {
        if (!payload.message) return;
        applyChatEventToInboxList(payload.supportRequestId, payload.message);
      });
    })();

    const unsubscribeTab = subscribeAdminSupportTabSync((event) => {
      if (event.type === 'CHAT_MESSAGE') {
        applyChatEventToInboxList(event.supportRequestId, event.message);
        return;
      }
      if (event.type === 'TICKET_STATUS') {
        handleTicketStatus(event);
        return;
      }
      if (event.type === 'INVALIDATE_REQUESTS') {
        scheduleSilentRefresh();
        return;
      }
      if (event.type === 'INVALIDATE_STATS') {
        void refreshStats();
      }
    });

    const onInvalidateRequests = () => {
      scheduleSilentRefresh();
    };
    const onInvalidateStats = () => {
      void refreshStats();
    };
    const onTicketStatus = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        supportRequestId: string;
        status: string;
        pendingResolutionAt?: string | null;
        autoResolveAt?: string | null;
      };
      if (detail?.supportRequestId && detail?.status) {
        handleTicketStatus(detail);
      }
    };
    const onChatPurged = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        supportRequestId: string;
      };
      if (!detail?.supportRequestId) return;
      setRequests((prev) => prev.filter((request) => request._id !== detail.supportRequestId));
      setOffPageTicket((prev) =>
        prev?._id === detail.supportRequestId ? null : prev,
      );
      setManageRequest((prev) =>
        prev?._id === detail.supportRequestId ? null : prev,
      );
      if (selectedTicketIdRef.current === detail.supportRequestId) {
        updateTicketInUrl(null);
      }
      scheduleSilentRefresh();
      void refreshStats();
    };

    window.addEventListener('admin-support:invalidate-requests', onInvalidateRequests);
    window.addEventListener('admin-support:invalidate-stats', onInvalidateStats);
    window.addEventListener('admin-support:ticket-status', onTicketStatus);
    window.addEventListener('admin-support:chat-purged', onChatPurged);

    return () => {
      unsubscribeSocket?.();
      unsubscribeStatus();
      unsubscribeNotifications();
      unsubscribeTab();
      if (silentRefreshTimerRef.current) {
        clearTimeout(silentRefreshTimerRef.current);
      }
      window.removeEventListener('admin-support:invalidate-requests', onInvalidateRequests);
      window.removeEventListener('admin-support:invalidate-stats', onInvalidateStats);
      window.removeEventListener('admin-support:ticket-status', onTicketStatus);
      window.removeEventListener('admin-support:chat-purged', onChatPurged);
    };
  }, [
    applyChatEventToInboxList,
    patchTicketInLists,
    refreshStats,
    scheduleSilentRefresh,
    updateTicketInUrl,
  ]);

  useEffect(() => {
    void fetchRequests(false);
  }, [fetchRequests]);

  useEffect(() => {
    highlightClearAttemptedRef.current = false;
    highlightHandledRef.current = null;
  }, [highlightRequestId]);

  useEffect(() => {
    if (!highlightRequestId || loading) return;
    if (highlightHandledRef.current === highlightRequestId) return;

    const row = requests.find((request) => request._id === highlightRequestId);

    const finishHighlight = (scrollToRow: boolean) => {
      highlightHandledRef.current = highlightRequestId;
      setHighlightFading(false);

      if (selectedTicketId !== highlightRequestId) {
        selectTicket(highlightRequestId);
      }

      if (scrollToRow && row) {
        requestAnimationFrame(() => {
          highlightedRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      const params = new URLSearchParams(searchParams.toString());
      if (params.has('highlight')) {
        params.delete('highlight');
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      }
    };

    if (row) {
      finishHighlight(true);
      const fadeTimer = window.setTimeout(() => setHighlightFading(true), 2000);
      return () => window.clearTimeout(fadeTimer);
    }

    const filtersBlocking =
      searchTerm ||
      statusFilter ||
      (!isPartner && activeOnlyFilter) ||
      categoryFilter ||
      (!isPartner && assigneeFilter !== 'all');

    if (filtersBlocking && !highlightClearAttemptedRef.current) {
      highlightClearAttemptedRef.current = true;
      setSearchTerm('');
      setStatusFilter('');
      setActiveOnlyFilter(false);
      setAssigneeFilter('all');
      setCategoryFilter('');
      setPagination((prev) => ({ ...prev, page: 1 }));
      return;
    }

    finishHighlight(false);
    const fadeTimer = window.setTimeout(() => setHighlightFading(true), 2000);
    return () => window.clearTimeout(fadeTimer);
  }, [
    highlightRequestId,
    loading,
    requests,
    pathname,
    router,
    searchParams,
    selectTicket,
    selectedTicketId,
    searchTerm,
    statusFilter,
    activeOnlyFilter,
    categoryFilter,
    assigneeFilter,
    isPartner,
  ]);

  const hasActiveFilters = Boolean(
    searchTerm ||
      statusFilter ||
      (!isPartner && activeOnlyFilter) ||
      categoryFilter ||
      (!isPartner && assigneeFilter !== 'all'),
  );

  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setStatusFilter('');
    setActiveOnlyFilter(false);
    setAssigneeFilter('all');
    setCategoryFilter('');
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const handleChatActivity = useCallback(() => {
    scheduleSilentRefresh();
  }, [scheduleSilentRefresh]);

  const handleTicketUpdated = useCallback(
    (ticketId: string, patch: Partial<SupportRequestRow>, options?: { reorder?: boolean }) => {
      setRequests((prev) => {
        const next = prev.map((request) =>
          request._id === ticketId ? { ...request, ...patch } : request,
        );
        if (options?.reorder) {
          return sortSupportInboxTickets(next);
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
    () => (selectedTicketId ? requests.find((request) => request._id === selectedTicketId) : null),
    [selectedTicketId, requests],
  );

  const resolvedActiveTicket = activeTicket ?? offPageTicket;
  resolvedActiveTicketRef.current = resolvedActiveTicket;

  const openTicketCloseConfirm = (
    ticket: SupportRequestRow,
    mode: 'request_confirmation' | 'force_resolve',
  ) => {
    setTicketCloseConfirm({ ticket, mode });
  };

  const handleCloseActiveTicket = () => {
    const ticket = resolvedActiveTicketRef.current;
    if (!ticket) return;
    openTicketCloseConfirm(ticket, 'request_confirmation');
  };

  const handleForceResolveActiveTicket = () => {
    const ticket = resolvedActiveTicketRef.current;
    if (!ticket || !isSuperAdmin) return;
    openTicketCloseConfirm(ticket, 'force_resolve');
  };

  const ticketCloseConfirmCopy = useMemo((): ConfirmToggleRequest | null => {
    if (!ticketCloseConfirm) return null;
    const referenceId = getTicketReferenceId(ticketCloseConfirm.ticket);
    if (ticketCloseConfirm.mode === 'force_resolve') {
      return {
        title: 'Resolve without customer confirmation?',
        description: `Ticket ${referenceId} will be marked resolved immediately. The customer will not be asked to confirm. This cannot be undone.`,
        confirmLabel: 'Resolve now',
      };
    }
    return {
      title: 'Close ticket and ask customer to confirm?',
      description: `Ticket ${referenceId} will move to pending customer confirmation. They can confirm resolution or reopen if they still need help.`,
      confirmLabel: 'Close ticket',
    };
  }, [ticketCloseConfirm]);

  const confirmTicketClose = async () => {
    if (!ticketCloseConfirm) return;
    const { ticket, mode } = ticketCloseConfirm;
    await applyManageUpdate(ticket, {
      status: SUPPORT_REQUEST_STATUS.RESOLVED,
      closeDialog: mode === 'request_confirmation',
      forceResolve: mode === 'force_resolve',
    });
    setTicketCloseConfirm(null);
  };

  const handleDeleteManageTicket = async () => {
    if (!manageRequest || !isSuperAdmin) return;

    const ticketId = manageRequest._id;
    const isTerminal =
      manageRequest.status === SUPPORT_REQUEST_STATUS.RESOLVED ||
      manageRequest.status === SUPPORT_REQUEST_STATUS.CLOSED;
    if (!isTerminal) {
      setManageSaveError('Only resolved or closed tickets can be deleted.');
      setManageDeleteConfirmOpen(false);
      return;
    }

    setDeletingTicketId(ticketId);
    setManageSaveError('');
    try {
      const res = await fetch(`/api/support-requests/${ticketId}/chat`, {
        method: 'DELETE',
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setManageSaveError(payload?.error || 'Failed to delete support ticket.');
        return;
      }

      setManageDeleteConfirmOpen(false);
      setManageRequest(null);
      setRequests((prev) => prev.filter((request) => request._id !== ticketId));
      if (selectedTicketId === ticketId) {
        updateTicketInUrl(null);
      }
      scheduleSilentRefresh();
      void refreshStats();
    } catch {
      setManageSaveError('Failed to delete support ticket. Please try again.');
    } finally {
      setDeletingTicketId(null);
    }
  };

  const openManageForActiveTicket = useCallback(() => {
    if (resolvedActiveTicket) {
      openManage(resolvedActiveTicket);
      return;
    }
    if (!selectedTicketId) return;
    fetch(`/api/support-requests/${selectedTicketId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) openManage(data as SupportRequestRow);
      })
      .catch(() => undefined);
  }, [resolvedActiveTicket, selectedTicketId, openManage]);

  useEffect(() => {
    if (!selectedTicketId) {
      setOffPageTicket(null);
      return;
    }
    if (activeTicket) {
      setOffPageTicket(null);
      return;
    }

    let cancelled = false;
    fetch(`/api/support-requests/${selectedTicketId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setOffPageTicket(data as SupportRequestRow);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [selectedTicketId, activeTicket]);

  const applyManageUpdate = async (
    request: SupportRequestRow,
    options: {
      status?: string;
      closeDialog?: boolean;
      assignToCurrentAdmin?: boolean;
      forceResolve?: boolean;
      assigneeIdOverride?: string;
    } = {},
  ) => {
    setUpdatingId(request._id);
    setManageSaveError('');
    try {
      const selectedAssigneeName = resolveAssigneeDisplayName(
        options.assigneeIdOverride ?? manageAssigneeId,
        assignableAdmins,
        manageLinkedPartners,
      );
      const selectedAssigneeId = options.assigneeIdOverride ?? manageAssigneeId;
      const originalAssignee = request.assignedAdminId
        ? String(request.assignedAdminId)
        : 'unassigned';
      const assigneeChanged =
        isSuperAdmin && !options.assignToCurrentAdmin && selectedAssigneeId !== originalAssignee;

      const res = await fetch(`/api/support-requests/${request._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(options.status ? { status: options.status } : {}),
          ...(options.forceResolve ? { forceResolve: true } : {}),
          previousStatus: request.status,
          ...(isSuperAdmin ? { adminNotes: manageNotes } : {}),
          ...(options.assignToCurrentAdmin && currentAdminId
            ? {
                assignedAdminId: currentAdminId,
                assignedAdminName: currentAdminName,
              }
            : isSuperAdmin
            ? {
                assignedAdminId: selectedAssigneeId === 'unassigned' ? null : selectedAssigneeId,
                assignedAdminName: selectedAssigneeName,
                ...(assigneeChanged
                  ? {
                      anchorMessageId: chatAnchorMessageId,
                    }
                  : {}),
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
        if (assigneeChanged) {
          setManageAssigneeId(selectedAssigneeId);
          setManageOriginalAssigneeId(selectedAssigneeId);
        }
        setChatRefreshKey((key) => key + 1);
        refreshStats();
        if (merged.status) {
          broadcastAdminSupportTabEvent({
            type: 'TICKET_STATUS',
            supportRequestId: request._id,
            status: merged.status,
            pendingResolutionAt: merged.pendingResolutionAt ?? null,
            autoResolveAt: merged.autoResolveAt ?? null,
          });
        }
        scheduleSilentRefresh();
        if (options.closeDialog) setManageRequest(null);
      } else {
        const payload = await res.json().catch(() => ({}));
        setManageSaveError(payload?.error || 'Failed to save ticket changes.');
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

  const handleAutoAssignReferralUser = async () => {
    if (!manageRequest || !isSuperAdmin) return;
    const autoAssigneeId = pickAutoReferralAssignee(manageLinkedPartners);
    if (!autoAssigneeId) {
      setManageSaveError('No linked referral user available to auto-assign.');
      return;
    }
    await applyManageUpdate(manageRequest, { assigneeIdOverride: autoAssigneeId });
  };

  const getStatusBadge = (status: string) => {
    const label = SUPPORT_REQUEST_STATUS_LABELS[status] ?? status;
    switch (status) {
      case SUPPORT_REQUEST_STATUS.RESOLVED:
      case SUPPORT_REQUEST_STATUS.CLOSED:
        return (
          <Badge>
            {status === SUPPORT_REQUEST_STATUS.CLOSED ? 'Closed' : label}
          </Badge>
        );
      case SUPPORT_REQUEST_STATUS.IN_PROGRESS:
        return <Badge variant="outline">{label}</Badge>;
      case SUPPORT_REQUEST_STATUS.PENDING_RESOLUTION:
        return <Badge variant="outline">{label}</Badge>;
      case SUPPORT_REQUEST_STATUS.OPEN:
      default:
        return <Badge variant="destructive">{label}</Badge>;
    }
  };

  const handleTicketLoaded = useCallback(
    (ticket: {
      adminNotes?: string;
      message?: string;
      subject?: string;
      status?: string;
      unreadByAdmin?: number;
      assignedAdminId?: string | null;
      assignedAdminName?: string;
      updatedAt?: string;
      latestMessageId?: string | null;
    }) => {
      if (!selectedTicketId) return;
      if (ticket.latestMessageId) {
        setChatAnchorMessageId(ticket.latestMessageId);
      }

      const current = resolvedActiveTicketRef.current;
      const patch: Partial<SupportRequestRow> = {};
      if (ticket.status && ticket.status !== current?.status) patch.status = ticket.status;
      if (
        ticket.unreadByAdmin !== undefined &&
        ticket.unreadByAdmin !== current?.unreadByAdmin
      ) {
        patch.unreadByAdmin = ticket.unreadByAdmin;
      }
      if (
        ticket.assignedAdminId !== undefined &&
        String(ticket.assignedAdminId ?? '') !== String(current?.assignedAdminId ?? '')
      ) {
        patch.assignedAdminId = ticket.assignedAdminId;
        patch.assignedAdminName = ticket.assignedAdminName;
      }
      if (ticket.adminNotes !== undefined && ticket.adminNotes !== current?.adminNotes) {
        patch.adminNotes = ticket.adminNotes;
      }
      if (ticket.subject && ticket.subject !== current?.subject) patch.subject = ticket.subject;
      if (ticket.message && ticket.message !== current?.message) patch.message = ticket.message;

      if (Object.keys(patch).length > 0) {
        handleTicketUpdated(selectedTicketId, patch);
      }

      if (ticket.unreadByAdmin === 0) {
        window.dispatchEvent(new Event('admin-notifications:refresh'));
        window.dispatchEvent(new Event('support-stats:refresh'));
      }
    },
    [selectedTicketId, handleTicketUpdated],
  );

  const categoryOptions = Object.values(SUPPORT_REQUEST_CATEGORY).map((value) => ({
    value,
    label: SUPPORT_REQUEST_CATEGORY_LABELS[value] || value,
  }));

  const statusOptions = Object.values(SUPPORT_REQUEST_STATUS).map((value) => ({
    value,
    label: SUPPORT_REQUEST_STATUS_LABELS[value] ?? value,
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
        className="min-h-0 flex-1"
        sidebar={
          <div className="flex h-full min-h-0 flex-col">
            <SupportInboxFilters
              searchTerm={searchTerm}
              onSearchChange={(value) => {
                setSearchTerm(value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              assigneeFilter={assigneeFilter}
              onAssigneeFilterChange={(value) => {
                setAssigneeFilter(value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              activeOnlyFilter={activeOnlyFilter}
              onActiveOnlyToggle={() => {
                setActiveOnlyFilter((prev) => !prev);
                setStatusFilter('');
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              statusFilter={statusFilter}
              onStatusChange={(value) => {
                setStatusFilter(value);
                setActiveOnlyFilter(false);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              statusOptions={statusOptions}
              categoryFilter={categoryFilter}
              onCategoryChange={(value) => {
                setCategoryFilter(value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              categoryOptions={categoryOptions}
              isSuperAdmin={isSuperAdmin}
              isPartner={isPartner}
              assignableAdmins={assignableAdmins}
              currentAdminId={currentAdminId}
              openTicketCount={stats.openSupportRequests}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={clearFilters}
            />

            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
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
                    const isSelected = selectedTicketId === request._id;
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
                            'min-w-0 flex-1 px-3 py-3 text-left transition-colors hover:bg-accent',
                            isSelected && 'hover:bg-primary/10',
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <Avatar className="size-9 shrink-0">
                              <AvatarFallback className="text-xs font-semibold">
                                {getSupportTicketAvatarInitials(getCompanyName(request))}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <p
                                  className="truncate text-sm font-medium"
                                  title={getSupportTicketSubjectTitle(
                                    request.subject,
                                    formatSupportTicketCustomerName(
                                      getCompanyName(request),
                                      formatUser(request.userId),
                                    ),
                                  )}
                                >
                                  {getSupportTicketSubjectTitle(
                                    request.subject,
                                    formatSupportTicketCustomerName(
                                      getCompanyName(request),
                                      formatUser(request.userId),
                                    ),
                                  )}
                                </p>
                                <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                                  {formatQueueDate(request.updatedAt || request.createdAt)}
                                </span>
                              </div>
                              <p
                                className="mt-0.5 truncate text-xs text-muted-foreground"
                                title={[
                                  formatSupportTicketCustomerName(
                                    getCompanyName(request),
                                    formatUser(request.userId),
                                  ),
                                  getSupportTicketPreviewText(request, { excludeSubject: true }),
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              >
                                {getSupportTicketPreviewText(request, { excludeSubject: true }) ||
                                  formatSupportTicketCustomerName(
                                    getCompanyName(request),
                                    formatUser(request.userId),
                                  )}
                              </p>
                              {isSuperAdmin && request.linkedReferralPartners?.length ? (
                                <p className="mt-1 truncate text-[10px] text-muted-foreground">
                                  Partners:{' '}
                                  {formatReferralPartnersSummary(request.linkedReferralPartners)}
                                </p>
                              ) : null}
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                <span className="font-mono text-[10px] text-muted-foreground">
                                  {getTicketReferenceId(request)}
                                </span>
                                {getStatusBadge(request.status)}
                                {request.assignedAdminName ? (
                                  <Badge
                                    variant="outline"
                                    className="max-w-[8rem] truncate text-[10px] font-normal"
                                    title={`Assigned to ${request.assignedAdminName}`}
                                  >
                                    {request.assignedAdminName}
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] font-normal text-muted-foreground"
                                  >
                                    Unassigned
                                  </Badge>
                                )}
                                {unread && (
                                  <SupportCountBadge count={request.unreadByAdmin ?? 0} />
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                        <div className="flex shrink-0 items-start pt-2 pr-2">
                          {isSuperAdmin ? (
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
                          ) : null}
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
                    <Pagination className="mx-0 w-auto">
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              handlePageChange(pagination.page - 1);
                            }}
                            aria-disabled={pagination.page === 1}
                            className={pagination.page === 1 ? 'pointer-events-none opacity-50' : ''}
                          />
                        </PaginationItem>
                        <PaginationItem>
                          <PaginationNext
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              handlePageChange(pagination.page + 1);
                            }}
                            aria-disabled={pagination.page >= pagination.pages}
                            className={pagination.page >= pagination.pages ? 'pointer-events-none opacity-50' : ''}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                </div>
              </div>
            )}
          </div>
        }
        main={
          <>
            {selectedTicketId ? (
              <TicketChatPanel
                key={selectedTicketId}
                requestId={selectedTicketId}
                referenceId={
                  resolvedActiveTicket ? getTicketReferenceId(resolvedActiveTicket) : undefined
                }
                subject={resolvedActiveTicket?.subject}
                ticketMessage={resolvedActiveTicket?.message}
                adminNotes={resolvedActiveTicket?.adminNotes}
                companyId={
                  resolvedActiveTicket ? getCompanyId(resolvedActiveTicket) ?? undefined : undefined
                }
                companyName={resolvedActiveTicket ? getCompanyName(resolvedActiveTicket) : undefined}
                userName={resolvedActiveTicket ? formatUser(resolvedActiveTicket.userId) : undefined}
                currentAdminId={currentAdminId}
                currentAdminName={currentAdminName}
                assignableAdmins={assignableAdmins}
                onActivity={handleChatActivity}
                onTicketLoaded={handleTicketLoaded}
                onOpenManage={isSuperAdmin ? openManageForActiveTicket : undefined}
                onCloseTicket={handleCloseActiveTicket}
                onForceResolveTicket={
                  isSuperAdmin ? handleForceResolveActiveTicket : undefined
                }
                isSuperAdmin={isSuperAdmin}
                isPartner={isPartner}
                onTicketDeleted={() => {
                  if (selectedTicketId) {
                    setRequests((prev) => prev.filter((request) => request._id !== selectedTicketId));
                  }
                  updateTicketInUrl(null);
                  scheduleSilentRefresh();
                  void refreshStats();
                }}
                closingTicket={updatingId === selectedTicketId}
                refreshKey={chatRefreshKey}
                className="h-full min-h-0"
              />
            ) : (
              <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
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
                <DialogTitle className="pr-8 leading-snug">
                  {getSupportTicketSubjectTitle(
                    manageRequest.subject,
                    formatSupportTicketCustomerName(
                      getCompanyName(manageRequest),
                      formatUser(manageRequest.userId),
                    ),
                  )}
                </DialogTitle>
                <DialogDescription>
                  {getTicketReferenceId(manageRequest)} ·{' '}
                  {SUPPORT_REQUEST_CATEGORY_LABELS[manageRequest.category]} ·{' '}
                  {formatSupportTicketCustomerName(
                    getCompanyName(manageRequest),
                    formatUser(manageRequest.userId),
                  )}
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
                        {manageAssigneeId && manageAssigneeId !== 'unassigned'
                          ? resolveAssigneeDisplayName(
                              manageAssigneeId,
                              assignableAdmins,
                              manageLinkedPartners,
                            )
                          : manageRequest.assignedAdminName?.trim() || 'Unassigned'}
                      </dd>
                    </div>
                    {isSuperAdmin ? (
                      <div className="space-y-1 sm:col-span-2">
                        <dt className="text-muted-foreground">Referral partners</dt>
                        <dd className="font-medium">
                          {formatReferralPartnersSummary(manageLinkedPartners) || (
                            <span className="text-muted-foreground font-normal">
                              No linked sales person or marketing affiliate
                            </span>
                          )}
                        </dd>
                      </div>
                    ) : null}
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
                        Read-only audit trail — status changes, assignments, support staff actions,
                        and partner activity.
                      </p>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <TicketStatusTimeline
                        entries={manageTicketHistory}
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
                        <div className="space-y-1">
                          <Label htmlFor="manage-assignee">Assign to</Label>
                          <p className="text-xs text-muted-foreground">
                            Internal staff or the linked referral partner for this customer.
                          </p>
                        </div>
                        <Select
                          value={manageAssigneeId || 'unassigned'}
                          onValueChange={setManageAssigneeId}
                          disabled={updatingId === manageRequest._id}
                        >
                          <SelectTrigger id="manage-assignee" className="w-full">
                            <SelectValue placeholder="Unassigned">
                              {resolveAssigneeDisplayName(
                                manageAssigneeId || 'unassigned',
                                assignableAdmins,
                                manageLinkedPartners,
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className={assigneeSelectContentClassName()}>
                            <AssigneeSelectOptions
                              assignableAdmins={assignableAdmins}
                              partners={manageLinkedPartners}
                            />
                          </SelectContent>
                        </Select>
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void handleAutoAssignReferralUser()}
                            disabled={
                              updatingId === manageRequest._id || manageLinkedPartners.length === 0
                            }
                          >
                            Auto-assign referral user
                          </Button>
                        </div>
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
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          Waiting for the customer to confirm resolution. The ticket stays
                          open until they confirm or reopen it.
                        </AlertDescription>
                      </Alert>
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
                        <>
                          <Button
                            type="button"
                            size="sm"
                            disabled={updatingId === manageRequest._id}
                            onClick={() =>
                              openTicketCloseConfirm(manageRequest, 'request_confirmation')
                            }
                          >
                            Close ticket
                          </Button>
                          {isSuperAdmin ? (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={updatingId === manageRequest._id}
                              onClick={() =>
                                openTicketCloseConfirm(manageRequest, 'force_resolve')
                              }
                            >
                              Resolve without confirmation
                            </Button>
                          ) : null}
                        </>
                      )}
                      {manageRequest.status === SUPPORT_REQUEST_STATUS.PENDING_RESOLUTION && (
                        <>
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
                          {isSuperAdmin ? (
                            <Button
                              type="button"
                              size="sm"
                              disabled={updatingId === manageRequest._id}
                              onClick={() =>
                                openTicketCloseConfirm(manageRequest, 'force_resolve')
                              }
                            >
                              Resolve without confirmation
                            </Button>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>

                  {isSuperAdmin &&
                  (manageRequest.status === SUPPORT_REQUEST_STATUS.RESOLVED ||
                    manageRequest.status === SUPPORT_REQUEST_STATUS.CLOSED) ? (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <Label className="text-destructive">Danger zone</Label>
                        <p className="text-xs text-muted-foreground">
                          Permanently deletes this ticket, all messages, and attachments. This
                          cannot be undone.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          disabled={deletingTicketId === manageRequest._id}
                          onClick={() => setManageDeleteConfirmOpen(true)}
                        >
                          {deletingTicketId === manageRequest._id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                          Delete ticket
                        </Button>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>

              {manageSaveError ? (
                <div className="border-t px-6 py-2">
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{manageSaveError}</AlertDescription>
                  </Alert>
                </div>
              ) : null}

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

      <ConfirmToggleDialog
        request={ticketCloseConfirmCopy}
        saving={Boolean(ticketCloseConfirm && updatingId === ticketCloseConfirm.ticket._id)}
        onConfirm={() => void confirmTicketClose()}
        onCancel={() => setTicketCloseConfirm(null)}
      />

      <AlertDialog open={manageDeleteConfirmOpen} onOpenChange={setManageDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete this ticket?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the ticket, all chat messages, and any image
              attachments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingTicketId)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              disabled={Boolean(deletingTicketId)}
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteManageTicket();
              }}
            >
              {deletingTicketId ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                'Delete ticket'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
