'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
} from '@/components/ui/dialog';
import {
  SUPPORT_REQUEST_STATUS,
  SUPPORT_REQUEST_CATEGORY,
  SUPPORT_REQUEST_CATEGORY_LABELS,
} from '@/lib/constants';
import { Search, Filter, Loader2, ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';

type SupportRequestRow = {
  _id: string;
  category: string;
  subject: string;
  message: string;
  status: string;
  adminNotes?: string;
  createdAt: string;
  companyId?: { name?: string };
  userId?: { firstName?: string; lastName?: string; emailAddress?: string };
};

export default function SupportRequestsPage() {
  const searchParams = useSearchParams();
  const highlightRequestId = searchParams.get('highlight');
  const highlightedRowRef = useRef<HTMLTableRowElement>(null);

  const [requests, setRequests] = useState<SupportRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [highlightFading, setHighlightFading] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<SupportRequestRow | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  });

  useEffect(() => {
    fetchRequests();
  }, [pagination.page, pagination.limit, searchTerm, statusFilter, categoryFilter]);

  useEffect(() => {
    if (highlightRequestId && !loading && highlightedRowRef.current) {
      highlightedRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const timer = setTimeout(() => setHighlightFading(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [highlightRequestId, loading, requests]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter && { status: statusFilter }),
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
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    setUpdatingId(id);
    const previousStatus =
      requests.find((r) => r._id === id)?.status ??
      (selectedRequest?._id === id ? selectedRequest.status : undefined);
    try {
      const res = await fetch(`/api/support-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, previousStatus }),
      });
      if (res.ok) {
        setRequests((prev) =>
          prev.map((r) => (r._id === id ? { ...r, status } : r))
        );
        if (selectedRequest?._id === id) {
          setSelectedRequest((prev) => (prev ? { ...prev, status } : null));
        }
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case SUPPORT_REQUEST_STATUS.RESOLVED:
        return <Badge className="bg-neutral-900 text-white">RESOLVED</Badge>;
      case SUPPORT_REQUEST_STATUS.CLOSED:
        return <Badge variant="secondary">CLOSED</Badge>;
      case SUPPORT_REQUEST_STATUS.IN_PROGRESS:
        return <Badge variant="outline">IN PROGRESS</Badge>;
      case SUPPORT_REQUEST_STATUS.OPEN:
      default:
        return <Badge variant="destructive">OPEN</Badge>;
    }
  };

  const formatUser = (user?: SupportRequestRow['userId']) => {
    if (!user) return 'Unknown user';
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
    return name ? `${name} (${user.emailAddress})` : user.emailAddress || 'Unknown user';
  };

  const categoryOptions = Object.values(SUPPORT_REQUEST_CATEGORY).map((value) => ({
    value,
    label: SUPPORT_REQUEST_CATEGORY_LABELS[value] || value,
  }));

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Support Requests</h2>
          <p className="text-neutral-500">
            Customer &quot;Talk to Support&quot; submissions from the product.
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm text-neutral-500 bg-white dark:bg-neutral-800 p-2 rounded-lg border">
          <div className="flex items-center gap-1 px-2">
            <Filter size={16} />
            <span className="font-bold text-neutral-900">{pagination.total}</span> Total
          </div>
          <div className="flex items-center gap-1 px-2 border-l">
            <span className="font-bold text-neutral-900">
              {requests.filter((r) => r.status === SUPPORT_REQUEST_STATUS.OPEN).length}
            </span>{' '}
            Open (this page)
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle>Request queue</CardTitle>
                <CardDescription>
                  {pagination.total > 0
                    ? `Showing ${requests.length} of ${pagination.total} requests`
                    : 'Filter and manage support requests.'}
                </CardDescription>
              </div>
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 h-4 w-4" />
                <Input
                  placeholder="Search company, subject..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                />
              </div>
            </div>

            <div className="flex items-center gap-4 pt-2 border-t flex-wrap">
              <Select
                value={categoryFilter || 'all'}
                onValueChange={(value) => {
                  setCategoryFilter(value === 'all' ? '' : value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
              >
                <SelectTrigger className="w-52">
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
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
              >
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  {Object.values(SUPPORT_REQUEST_STATUS).map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('');
                  setCategoryFilter('');
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
              >
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
                <TableHead>Category</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="pl-6">
                      <Skeleton className="h-4 w-[120px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-[140px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-[100px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-[150px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-[80px] rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-[100px]" />
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Skeleton className="h-8 w-8 ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-48 text-neutral-500">
                    No support requests found.
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((request) => {
                  const isHighlighted = highlightRequestId === request._id;
                  return (
                    <TableRow
                      key={request._id}
                      ref={isHighlighted ? highlightedRowRef : null}
                      className={`transition-all duration-1000 ${
                        isHighlighted && !highlightFading
                          ? 'bg-yellow-100 dark:bg-yellow-900/30'
                          : ''
                      }`}
                    >
                      <TableCell className="pl-6 font-medium">
                        {request.companyId?.name || 'Unknown'}
                      </TableCell>
                      <TableCell className="text-sm max-w-[180px] truncate" title={formatUser(request.userId)}>
                        {formatUser(request.userId)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {SUPPORT_REQUEST_CATEGORY_LABELS[request.category] || request.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={request.subject}>
                        {request.subject}
                      </TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell className="text-sm">
                        {new Date(request.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setSelectedRequest(request)}
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                          {request.status === SUPPORT_REQUEST_STATUS.OPEN && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={updatingId === request._id}
                              onClick={() =>
                                handleUpdateStatus(request._id, SUPPORT_REQUEST_STATUS.IN_PROGRESS)
                              }
                            >
                              {updatingId === request._id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                'Start'
                              )}
                            </Button>
                          )}
                          {request.status !== SUPPORT_REQUEST_STATUS.RESOLVED &&
                            request.status !== SUPPORT_REQUEST_STATUS.CLOSED && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={updatingId === request._id}
                                onClick={() =>
                                  handleUpdateStatus(request._id, SUPPORT_REQUEST_STATUS.RESOLVED)
                                }
                              >
                                Resolve
                              </Button>
                            )}
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
              <div className="text-sm text-neutral-500">
                Page {pagination.page} of {pagination.pages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                >
                  <ChevronLeft size={16} />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page === pagination.pages}
                >
                  Next
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          {selectedRequest && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedRequest.subject}</DialogTitle>
                <DialogDescription>
                  {SUPPORT_REQUEST_CATEGORY_LABELS[selectedRequest.category]} ·{' '}
                  {selectedRequest.companyId?.name}
                </DialogDescription>
              </DialogHeader>
              <p className="text-sm text-neutral-500">{formatUser(selectedRequest.userId)}</p>
              <p className="text-sm whitespace-pre-wrap border rounded-md p-3 bg-muted/30">
                {selectedRequest.message}
              </p>
              <div className="flex items-center gap-2 pt-2">
                {getStatusBadge(selectedRequest.status)}
                <Select
                  value={selectedRequest.status}
                  onValueChange={(status) => handleUpdateStatus(selectedRequest._id, status)}
                  disabled={updatingId === selectedRequest._id}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(SUPPORT_REQUEST_STATUS).map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
