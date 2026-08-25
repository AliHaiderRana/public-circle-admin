'use client';

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import Link from 'next/link';
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
  FEEDBACK_STATUS,
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_TYPE,
  FEEDBACK_TYPE_LABELS,
} from '@/lib/constants';
import type { FeedbackItem } from '@/lib/feedback.types';
import { cn } from '@/lib/utils';
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  MessageSquarePlus,
  RefreshCw,
  Search,
  Star,
} from 'lucide-react';

function formatUserName(user?: FeedbackItem['userId']) {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return name || user?.emailAddress || 'Unknown user';
}

function formatDateTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return {
    date: date.toLocaleDateString(),
    time: date.toLocaleTimeString(),
    full: `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`,
  };
}

function DateTimeDisplay({
  value,
  compact = false,
}: {
  value?: string | null;
  compact?: boolean;
}) {
  const formatted = formatDateTime(value);
  if (!formatted) {
    return <span className="text-muted-foreground">—</span>;
  }
  if (compact) {
    return <span>{formatted.full}</span>;
  }
  return (
    <>
      <div>{formatted.date}</div>
      <div className="text-xs text-muted-foreground">{formatted.time}</div>
    </>
  );
}

function ExternalEntityLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title="Opens in a new tab"
      className={cn(
        'inline-flex max-w-full items-center gap-1 font-medium text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      onClick={(event: MouseEvent) => {
        event.stopPropagation();
      }}
    >
      <span className="truncate">{children}</span>
      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="sr-only">(opens in a new tab)</span>
    </Link>
  );
}

function DetailField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1 text-sm">
      <dt className="pt-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 break-words text-foreground">{children}</dd>
    </div>
  );
}

function entityId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string' || typeof value === 'number') {
    const id = String(value).trim();
    return id || null;
  }
  if (typeof value === 'object' && value !== null && 'toString' in value) {
    const id = String((value as { toString(): string }).toString()).trim();
    if (id && id !== '[object Object]') return id;
  }
  return null;
}

function companyHref(company?: FeedbackItem['companyId'] | null) {
  const id = entityId(company?._id);
  return id ? `/dashboard/companies/${id}` : null;
}

function userHref(user?: FeedbackItem['userId'] | null) {
  const email = user?.emailAddress?.trim();
  if (email) return `/dashboard/users?search=${encodeURIComponent(email)}`;
  const id = entityId(user?._id);
  return id ? `/dashboard/users?search=${encodeURIComponent(id)}` : null;
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

  const hasActiveFilters = Boolean(searchTerm.trim() || statusFilter || typeFilter);
  const newCount = items.filter((item) => item.status === FEEDBACK_STATUS.NEW).length;
  const totalPages = Math.max(pagination.pages, 1);

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages) return;
    setPagination((prev) => ({ ...prev, page: nextPage }));
  };

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Product Feedback</h2>
          <p className="text-muted-foreground">
            Review feature requests, bugs, and product comments from customer accounts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void fetchItems()}
            disabled={loading}
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
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

              {hasActiveFilters ? (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
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
                <TableHead>Updated</TableHead>
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
                    <TableCell>
                      <Skeleton className="h-4 w-[100px]" />
                    </TableCell>
                  </TableRow>
                ))
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-48 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <MessageSquarePlus size={40} className="text-muted-foreground/50" />
                      <p>
                        {hasActiveFilters
                          ? 'No feedback found matching your filters.'
                          : 'No product feedback yet.'}
                      </p>
                      {hasActiveFilters ? (
                        <Button variant="outline" size="sm" onClick={clearFilters}>
                          Clear filters
                        </Button>
                      ) : null}
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
                        {(() => {
                          const href = companyHref(item.companyId);
                          const label = item.companyId?.name || 'Unknown Company';
                          return href ? (
                            <ExternalEntityLink href={href}>{label}</ExternalEntityLink>
                          ) : (
                            label
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const href = userHref(item.userId);
                          const name = formatUserName(item.userId);
                          return (
                            <>
                              {href ? (
                                <ExternalEntityLink href={href}>{name}</ExternalEntityLink>
                              ) : (
                                <div className="text-sm font-medium">{name}</div>
                              )}
                              {item.userId?.emailAddress ? (
                                <div className="text-xs text-muted-foreground">
                                  {item.userId.emailAddress}
                                </div>
                              ) : null}
                            </>
                          );
                        })()}
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
                        <DateTimeDisplay value={item.createdAt} />
                      </TableCell>
                      <TableCell className="text-sm">
                        <DateTimeDisplay value={item.updatedAt} />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          </div>

          {pagination.total > 0 && (
            <div className="flex items-center justify-between border-t px-6 py-4">
              <div className="text-sm text-muted-foreground">
                Page {pagination.page} of {totalPages} ({pagination.total} total)
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                >
                  <ChevronLeft size={16} />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= totalPages}
                >
                  Next
                  <ChevronRight size={16} />
                </Button>
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
              Review this submission and update its status or notes.
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-5">
              <dl className="space-y-3 rounded-lg border bg-muted/30 p-4">
                <DetailField label="Company">
                  {(() => {
                    const href = companyHref(selected.companyId);
                    const label = selected.companyId?.name || 'Unknown company';
                    return href ? (
                      <ExternalEntityLink href={href}>{label}</ExternalEntityLink>
                    ) : (
                      <span className="font-medium">{label}</span>
                    );
                  })()}
                </DetailField>
                <DetailField label="User">
                  {(() => {
                    const href = userHref(selected.userId);
                    const name = formatUserName(selected.userId);
                    return (
                      <div className="space-y-0.5">
                        {href ? (
                          <ExternalEntityLink href={href}>{name}</ExternalEntityLink>
                        ) : (
                          <span className="font-medium">{name}</span>
                        )}
                        {selected.userId?.emailAddress ? (
                          <p className="text-xs text-muted-foreground">
                            {selected.userId.emailAddress}
                          </p>
                        ) : null}
                      </div>
                    );
                  })()}
                </DetailField>
                <DetailField label="Type">
                  <Badge variant="outline">
                    {FEEDBACK_TYPE_LABELS[selected.type] || selected.type}
                  </Badge>
                </DetailField>
                <DetailField label="Rating">
                  {selected.rating ? (
                    <span className="inline-flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-current" />
                      {selected.rating}/5
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </DetailField>
                <DetailField label="Message">
                  <p className="whitespace-pre-wrap">{selected.message}</p>
                </DetailField>
                {selected.pagePath ? (
                  <DetailField label="Page">
                    <span className="font-mono text-xs text-muted-foreground">
                      {selected.pagePath}
                    </span>
                  </DetailField>
                ) : null}
                <DetailField label="Submitted">
                  <DateTimeDisplay value={selected.createdAt} compact />
                </DetailField>
                <DetailField label="Updated">
                  <DateTimeDisplay value={selected.updatedAt} compact />
                </DetailField>
              </dl>

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
