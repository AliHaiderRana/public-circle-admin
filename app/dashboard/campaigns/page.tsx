'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Send, BarChart3, Mail, CheckCircle2, Clock, ChevronLeft, ChevronRight, Filter, Building2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

interface Company {
  _id: string;
  name: string;
}

export default function CampaignsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState(searchParams.get('company') || '');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });

  // Fetch all companies for the filter dropdown
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const res = await fetch('/api/companies?limit=1000');
        const data = await res.json();
        if (data.companies) {
          setCompanies(data.companies);
        }
      } catch (err) {
        console.error('Failed to load companies');
      }
    };
    fetchCompanies();
  }, []);

  // Find company name by ID for display
  const getCompanyNameById = (companyId: string) => {
    const company = companies.find(c => c._id === companyId);
    return company?.name || '';
  };

  useEffect(() => {
    fetchCampaigns();
  }, [pagination.page, pagination.limit, searchTerm, statusFilter, companyFilter, sortOrder]);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sort: sortOrder,
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter && { status: statusFilter }),
        ...(companyFilter && { company: companyFilter })
      });
      
      const res = await fetch(`/api/campaigns?${params}`);
      const data = await res.json();
      
      if (data.campaigns) {
        setCampaigns(data.campaigns);
        setPagination(data.pagination);
      } else {
        setCampaigns([]);
      }
    } catch (err) {
      console.error('Failed to load campaigns');
      setCampaigns([]);
    } finally {
      setLoading(false);
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
    setCompanyFilter('');
    setSortOrder('desc');
    setPagination(prev => ({ ...prev, page: 1 }));
    // Clear URL params
    router.push('/dashboard/campaigns');
  };

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge className="bg-neutral-900 text-white">Active</Badge>;
      case 'PAUSED':
        return <Badge variant="secondary">Paused</Badge>;
      case 'DRAFT':
        return <Badge variant="outline">Draft</Badge>;
      case 'ARCHIVED':
        return <Badge variant="destructive">Archived</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };
  const uniqueStatuses = [...new Set(campaigns.map(c => c.status).filter(Boolean))];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Campaigns</h2>
          <p className="text-neutral-500">Manage email campaigns across all companies.</p>
        </div>
        <div className="flex items-center gap-4 text-sm text-neutral-500 bg-white dark:bg-neutral-800 p-2 rounded-lg border">
          <div className="flex items-center gap-1 px-2">
            <Send size={16} />
            <span className="font-bold text-neutral-900">{pagination.total}</span> Total
          </div>
          <div className="flex items-center gap-1 px-2 border-l">
            <span className="font-bold text-neutral-900">
              {campaigns.filter(c => c.status === 'ACTIVE').length}
            </span> Active
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle>Campaign Management</CardTitle>
                <CardDescription>
                  {pagination.total > 0 ? `Showing ${campaigns.length} of ${pagination.total} campaigns` : 'Search and filter email campaigns.'}
                </CardDescription>
              </div>
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 h-4 w-4" />
                <Input 
                  placeholder="Search campaigns..." 
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
              
              <Select value={statusFilter || 'all'} onValueChange={(value) => {
                setStatusFilter(value === 'all' ? '' : value);
                setPagination(prev => ({ ...prev, page: 1 }));
              }}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="PAUSED">Paused</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
                </SelectContent>
              </Select>

              <Select value={companyFilter || 'all'} onValueChange={(value) => {
                setCompanyFilter(value === 'all' ? '' : value);
                setPagination(prev => ({ ...prev, page: 1 }));
              }}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Company">
                    {companyFilter ? (
                      <div className="flex items-center gap-2">
                        <Building2 size={14} className="text-neutral-500" />
                        <span className="truncate">{getCompanyNameById(companyFilter) || 'Selected Company'}</span>
                      </div>
                    ) : (
                      'All Companies'
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="all">All Companies</SelectItem>
                  {companies.map(company => (
                    <SelectItem key={company._id} value={company._id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Sort Order Button */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={toggleSortOrder}
                className="flex items-center gap-2"
              >
                {sortOrder === 'desc' ? (
                  <>
                    <ArrowDown size={14} />
                    <span>Newest First</span>
                  </>
                ) : (
                  <>
                    <ArrowUp size={14} />
                    <span>Oldest First</span>
                  </>
                )}
              </Button>
              
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
                <TableHead className="pl-6">Campaign Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={toggleSortOrder}
                    className="flex items-center gap-1 -ml-2 h-auto p-1 font-medium hover:bg-transparent"
                  >
                    Created
                    {sortOrder === 'desc' ? (
                      <ArrowDown size={14} className="text-primary" />
                    ) : (
                      <ArrowUp size={14} className="text-primary" />
                    )}
                  </Button>
                </TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="pl-6"><Skeleton className="h-4 w-[150px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[180px]" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-[80px] rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                    <TableCell className="text-right pr-6"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : campaigns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-48 text-neutral-500">
                    <div className="flex flex-col items-center gap-2">
                      <Send size={40} className="text-neutral-300" />
                      <p>No campaigns found matching your filters.</p>
                      <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                campaigns.map((campaign) => (
                  <TableRow key={campaign._id}>
                    <TableCell className="pl-6 font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                          <Mail className="w-4 h-4 text-white" />
                        </div>
                        {campaign.campaignName || campaign.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Building2 size={12} className="text-neutral-400" />
                        {campaign.company?.name || 'No Company'}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate" title={campaign.emailSubject}>
                      {campaign.emailSubject}
                    </TableCell>
                    <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                    <TableCell className="text-sm">
                      <div>{new Date(campaign.createdAt).toLocaleDateString()}</div>
                      <div className="text-xs text-neutral-500">{new Date(campaign.createdAt).toLocaleTimeString()}</div>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => router.push(`/dashboard/campaigns/${campaign._id}`)}
                      >
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <div className="text-sm text-neutral-500">
                Page {pagination.page} of {pagination.pages} ({pagination.total} total campaigns)
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
