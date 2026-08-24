'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  FEEDBACK_STATUS,
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_TYPE,
  FEEDBACK_TYPE_LABELS,
} from '@/lib/constants';
import { Filter, Loader2, MessageSquarePlus, Search, Star } from 'lucide-react';

type FeedbackItem = {
  _id: string;
  type: string;
  message: string;
  rating?: number | null;
  pagePath?: string;
  status: string;
  adminNotes?: string;
  createdAt: string;
  companyId?: { _id?: string; name?: string } | null;
  userId?: {
    _id?: string;
    firstName?: string;
    lastName?: string;
    emailAddress?: string;
  } | null;
};

function formatUserName(user?: FeedbackItem['userId']) {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return name || user?.emailAddress || 'Unknown user';
}

function getStatusBadge(status: string) {
  switch (status) {
    case FEEDBACK_STATUS.NEW:
      return <Badge variant="outline">{FEEDBACK_STATUS_LABELS[status]}</Badge>;
    case FEEDBACK_STATUS.REVIEWED:
      return <Badge variant="secondary">{FEEDBACK_STATUS_LABELS[status]}</Badge>;
    case FEEDBACK_STATUS.PLANNED:
      return <Badge>{FEEDBACK_STATUS_LABELS[status]}</Badge>;
    case FEEDBACK_STATUS.DONE:
      return <Badge>{FEEDBACK_STATUS_LABELS[status]}</Badge>;
    case FEEDBACK_STATUS.DISMISSED:
      return <Badge variant="destructive">{FEEDBACK_STATUS_LABELS[status]}</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function isPopulatedCompany(
  value: FeedbackItem['companyId'] | string | null | undefined,
): value is NonNullable<FeedbackItem['companyId']> {
  return Boolean(value && typeof value === 'object' && 'name' in value);
}

function isPopulatedUser(
  value: FeedbackItem['userId'] | string | null | undefined,
): value is NonNullable<FeedbackItem['userId']> {
  return Boolean(
    value &&
      typeof value === 'object' &&
      ('firstName' in value || 'lastName' in value || 'emailAddress' in value),
  );
}

function mergeFeedbackUpdate(current: FeedbackItem, updated: FeedbackItem): FeedbackItem {
  return {
    ...current,
    ...updated,
    companyId: isPopulatedCompany(updated.companyId)
      ? updated.companyId
      : current.companyId,
    userId: isPopulatedUser(updated.userId) ? updated.userId : current.userId,
  };
}

export default function FeedbackPage() {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const highlightedRowRef = useRef<HTMLTableRowElement>(null);

  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [highlightFading, setHighlightFading] = useState(false);
  const [selected, setSelected] = useState<FeedbackItem | null>(null);
  const [detailNotes, setDetailNotes] = useState('');
  const [detailStatus, setDetailStatus] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  });

  useEffect(() => {
    void fetchItems();
  }, [pagination.page, pagination.limit, searchTerm, statusFilter, typeFilter]);

  useEffect(() => {
    if (highlightId && !loading && highlightedRowRef.current) {
      highlightedRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const timer = setTimeout(() => setHighlightFading(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [highlightId, loading, items]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter && { status: statusFilter }),
        ...(typeFilter && { type: typeFilter }),
      });

      const res = await fetch(`/api/feedback?${params}`);
      const data = await res.json();

      if (data.items) {
        setItems(data.items);
        setPagination(data.pagination);
      } else {
        setItems([]);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (
    id: string,
    payload: { status?: string; adminNotes?: string },
  ) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/feedback/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updated = (await res.json()) as FeedbackItem;
        setItems((prev) =>
          prev.map((item) => (item._id === id ? mergeFeedbackUpdate(item, updated) : item)),
        );
        setSelected(null);
        window.dispatchEvent(new Event('support-stats:refresh'));
      }
    } catch (err) {
      console.error('Failed to update feedback', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const openDetails = (item: FeedbackItem) => {
    setSelected(item);
    setDetailNotes(item.adminNotes || '');
    setDetailStatus(item.status);
  };

  const closeDetails = () => {
    if (updatingId) return;
    setSelected(null);
  };

  const hasUnsavedChanges = Boolean(
    selected &&
      (detailStatus !== selected.status ||
        detailNotes !== (selected.adminNotes || '')),
  );

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setTypeFilter('');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const newCount = items.filter((item) => item.status === FEEDBACK_STATUS.NEW).length;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Product Feedback</h2>
          <p className="text-muted-foreground">
            Review feature requests, bugs, and product comments from customer accounts.
          </p>
        </div>
        <div className="flex items-center gap-4 rounded-lg border bg-card p-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-1 px-2">
            <Filter size={16} />
            <span className="font-bold text-foreground">{pagination.total}</span> Total
          </div>
          <div className="flex items-center gap-1 border-l px-2">
            <span className="font-bold text-foreground">{newCount}</span> New on this page
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle>Feedback inbox</CardTitle>
                <CardDescription>
                  {pagination.total > 0
                    ? `Showing ${items.length} of ${pagination.total} submissions`
                    : 'Filter and review product feedback.'}
                </CardDescription>
              </div>
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search company, user, or message..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                />
              </div>
            </div>

            <div className="flex items-center gap-4 border-t pt-2">
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-muted-foreground" />
                <span className="text-sm font-medium">Filters:</span>
              </div>

              <Select
                value={typeFilter || 'all'}
                onValueChange={(value) => {
                  setTypeFilter(value === 'all' ? '' : value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {Object.values(FEEDBACK_TYPE).map((type) => (
                    <SelectItem key={type} value={type}>
                      {FEEDBACK_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={statusFilter || 'all'}
                onValueChange={(value) => {
                  setStatusFilter(value === 'all' ? '' : value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  {Object.values(FEEDBACK_STATUS).map((status) => (
                    <SelectItem key={status} value={status}>
                      {FEEDBACK_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Company</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell className="pl-6">
                      <Skeleton className="h-4 w-[120px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-[140px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-[90px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-[180px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-[40px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-[80px] rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-[100px]" />
                    </TableCell>
                  </TableRow>
                ))
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <MessageSquarePlus size={40} className="text-muted-foreground/50" />
                      <p>No feedback found matching your filters.</p>
                      <Button variant="outline" size="sm" onClick={clearFilters}>
                        Clear filters
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => {
                  const isHighlighted = highlightId === item._id;
                  return (
                    <TableRow
                      key={item._id}
                      ref={isHighlighted ? highlightedRowRef : null}
                      className={`cursor-pointer transition-all duration-1000 ${
                        isHighlighted && !highlightFading
                          ? 'bg-yellow-100 dark:bg-yellow-900/30'
                          : ''
                      }`}
                      onClick={() => openDetails(item)}
                    >
                      <TableCell className="pl-6 font-medium">
                        {item.companyId?.name || 'Unknown Company'}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{formatUserName(item.userId)}</div>
                        {item.userId?.emailAddress && (
                          <div className="text-xs text-muted-foreground">
                            {item.userId.emailAddress}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {FEEDBACK_TYPE_LABELS[item.type] || item.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate" title={item.message}>
                        {item.message}
                      </TableCell>
                      <TableCell>
                        {item.rating ? (
                          <span className="inline-flex items-center gap-1 text-sm">
                            <Star className="h-3.5 w-3.5 fill-current" />
                            {item.rating}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell className="text-sm">
                        <div>{new Date(item.createdAt).toLocaleDateString()}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(item.createdAt).toLocaleTimeString()}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {pagination.pages > 1 && (
            <div className="flex items-center justify-between border-t px-6 py-4">
              <div className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.pages} ({pagination.total} total)
              </div>
              <div className="flex items-center gap-2">
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
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
                <Pagination className="mx-0 w-auto">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          if (pagination.page > 1) {
                            setPagination((prev) => ({ ...prev, page: prev.page - 1 }));
                          }
                        }}
                        aria-disabled={pagination.page === 1}
                        className={pagination.page === 1 ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          if (pagination.page < pagination.pages) {
                            setPagination((prev) => ({ ...prev, page: prev.page + 1 }));
                          }
                        }}
                        aria-disabled={pagination.page === pagination.pages}
                        className={
                          pagination.page === pagination.pages
                            ? 'pointer-events-none opacity-50'
                            : ''
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) closeDetails();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Feedback details</DialogTitle>
            <DialogDescription>
              {selected?.companyId?.name || 'Unknown company'} · {formatUserName(selected?.userId)}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {FEEDBACK_TYPE_LABELS[selected.type] || selected.type}
                </Badge>
                {getStatusBadge(selected.status)}
                {selected.rating ? (
                  <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                    <Star className="h-3.5 w-3.5 fill-current" />
                    {selected.rating}/5
                  </span>
                ) : null}
              </div>
              <p className="whitespace-pre-wrap text-sm">{selected.message}</p>
              {selected.pagePath ? (
                <p className="text-xs text-muted-foreground">Page: {selected.pagePath}</p>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="feedback-status">Status</Label>
                <Select
                  value={detailStatus}
                  onValueChange={setDetailStatus}
                  disabled={updatingId === selected._id}
                >
                  <SelectTrigger id="feedback-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(FEEDBACK_STATUS).map((status) => (
                      <SelectItem key={status} value={status}>
                        {FEEDBACK_STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="feedback-notes">Internal notes</Label>
                <Textarea
                  id="feedback-notes"
                  value={detailNotes}
                  onChange={(event) => setDetailNotes(event.target.value)}
                  rows={4}
                  placeholder="Visible to admins only"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDetails} disabled={Boolean(updatingId)}>
              Cancel
            </Button>
            <Button
              disabled={!selected || !hasUnsavedChanges || updatingId === selected?._id}
              onClick={() => {
                if (!selected) return;
                void handleUpdate(selected._id, {
                  status: detailStatus,
                  adminNotes: detailNotes,
                });
              }}
            >
              {updatingId === selected?._id ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
