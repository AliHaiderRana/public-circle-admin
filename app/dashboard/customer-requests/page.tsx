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
  TableRow 
} from '@/components/ui/table';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CUSTOMER_REQUEST_STATUS, CUSTOMER_REQUEST_TYPE } from '@/lib/constants';
import { Check, X, Search, Filter, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

export default function CustomerRequestsPage() {
  const searchParams = useSearchParams();
  const highlightRequestId = searchParams.get('highlight');
  const highlightedRowRef = useRef<HTMLTableRowElement>(null);
  
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [highlightFading, setHighlightFading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });

  useEffect(() => {
    fetchRequests();
  }, [pagination.page, pagination.limit, searchTerm, statusFilter, typeFilter]);

  // Scroll to highlighted request when loaded
  useEffect(() => {
    if (highlightRequestId && !loading && highlightedRowRef.current) {
      highlightedRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Start fade animation after a delay
      const timer = setTimeout(() => {
        setHighlightFading(true);
      }, 2000);
      
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
        ...(typeFilter && { type: typeFilter })
      });
      
      const res = await fetch(`/api/customer-requests?${params}`);
      const data = await res.json();
      
      if (data.requests) {
        setRequests(data.requests);
        setPagination(data.pagination);
      } else {
        setRequests([]);
      }
    } catch (err) {
      console.error('Failed to load requests');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/customer-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setRequests(prev => prev.map(r => r._id === id ? { ...r, requestStatus: status } : r));
      }
    } catch (err) {
      console.error('Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setTypeFilter('');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case CUSTOMER_REQUEST_STATUS.COMPLETED:
        return <Badge className="bg-neutral-900 text-white">COMPLETED</Badge>;
      case CUSTOMER_REQUEST_STATUS.REJECTED:
        return <Badge variant="destructive">REJECTED</Badge>;
      case CUSTOMER_REQUEST_STATUS.PENDING:
        return <Badge variant="secondary">PENDING</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // Request types for filter
  const requestTypes = [
    { value: CUSTOMER_REQUEST_TYPE.EDIT_CONTACTS_PRIMARY_KEY, label: 'PRIMARY KEY' },
    { value: CUSTOMER_REQUEST_TYPE.EDIT_CONTACTS_EMAIL_KEY, label: 'EMAIL KEY' },
    { value: CUSTOMER_REQUEST_TYPE.EDIT_CONTACTS_FILTERS, label: 'FILTERS' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Customer Requests</h2>
          <p className="text-neutral-500">Manage sensitive edit requests from companies.</p>
        </div>
        <div className="flex items-center gap-4 text-sm text-neutral-500 bg-white dark:bg-neutral-800 p-2 rounded-lg border">
          <div className="flex items-center gap-1 px-2">
            <Filter size={16} />
            <span className="font-bold text-neutral-900">{pagination.total}</span> Total
          </div>
          <div className="flex items-center gap-1 px-2 border-l">
            <span className="font-bold text-neutral-900">
              {requests.filter(r => r.requestStatus === CUSTOMER_REQUEST_STATUS.PENDING).length}
            </span> Pending
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle>Request Management</CardTitle>
                <CardDescription>
                  {pagination.total > 0 ? `Showing ${requests.length} of ${pagination.total} requests` : 'Filter and manage customer requests.'}
                </CardDescription>
              </div>
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 h-4 w-4" />
                <Input 
                  placeholder="Search company or reason..." 
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
            </div>
            
            {/* Filters */}
            <div className="flex items-center gap-4 pt-2 border-t">
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-neutral-500" />
                <span className="text-sm font-medium">Filters:</span>
              </div>
              
              <Select value={typeFilter || 'all'} onValueChange={(value) => {
                setTypeFilter(value === 'all' ? '' : value);
                setPagination(prev => ({ ...prev, page: 1 }));
              }}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Request Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {requestTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter || 'all'} onValueChange={(value) => {
                setStatusFilter(value === 'all' ? '' : value);
                setPagination(prev => ({ ...prev, page: 1 }));
              }}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value={CUSTOMER_REQUEST_STATUS.PENDING}>PENDING</SelectItem>
                  <SelectItem value={CUSTOMER_REQUEST_STATUS.COMPLETED}>COMPLETED</SelectItem>
                  <SelectItem value={CUSTOMER_REQUEST_STATUS.REJECTED}>REJECTED</SelectItem>
                </SelectContent>
              </Select>
              
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Company</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requested Date</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="pl-6"><Skeleton className="h-4 w-[120px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-[80px] rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                    <TableCell className="text-right pr-6"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-48 text-neutral-500">
                    <div className="flex flex-col items-center gap-2">
                      <Filter size={40} className="text-neutral-300" />
                      <p>No requests found matching your filters.</p>
                      <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>
                    </div>
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
                      <TableCell className="pl-6 font-medium">{request.companyId?.name || 'Unknown Company'}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline">
                          {request.type.replace('EDIT_CONTACTS_', '').replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={request.reason}>
                        {request.reason || 'No reason provided'}
                      </TableCell>
                      <TableCell>{getStatusBadge(request.requestStatus)}</TableCell>
                      <TableCell className="text-sm">
                        <div>{new Date(request.createdAt).toLocaleDateString()}</div>
                        <div className="text-xs text-neutral-500">{new Date(request.createdAt).toLocaleTimeString()}</div>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        {request.requestStatus === CUSTOMER_REQUEST_STATUS.PENDING && (
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="icon" 
                              className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => handleUpdateStatus(request._id, CUSTOMER_REQUEST_STATUS.COMPLETED)}
                              disabled={updatingId === request._id}
                            >
                              {updatingId === request._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            </Button>
                            <Button 
                              variant="outline" 
                              size="icon" 
                              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleUpdateStatus(request._id, CUSTOMER_REQUEST_STATUS.REJECTED)}
                              disabled={updatingId === request._id}
                            >
                              {updatingId === request._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                            </Button>
                          </div>
                        )}
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
                Page {pagination.page} of {pagination.pages} ({pagination.total} total requests)
              </div>
              <div className="flex items-center gap-2">
                <Select 
                  value={pagination.limit.toString()} 
                  onValueChange={(value) => {
                    setPagination(prev => ({ ...prev, limit: parseInt(value), page: 1 }));
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
    </div>
  );
}
