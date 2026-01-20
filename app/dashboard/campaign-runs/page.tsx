'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { Search, Play, BarChart3, Mail, Clock, ChevronLeft, ChevronRight, Filter, Building2, Calendar, Database } from 'lucide-react';

interface CampaignRun {
  _id: string;
  company: {
    _id: string;
    name: string;
  };
  campaign: {
    _id: string;
    campaignName: string;
    emailSubject: string;
  };
  isDataStoredOnWarehouse: boolean;
  emailsSentCount: number;
  emailCounts?: {
    total: number;
    to: number;
    cc: number;
    bcc: number;
  };
  createdAt: string;
  updatedAt: string;
}

export default function CampaignRunsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [campaignRuns, setCampaignRuns] = useState<CampaignRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [companyFilter, setCompanyFilter] = useState(searchParams.get('company') || '');
  const [campaignFilter, setCampaignFilter] = useState(searchParams.get('campaign') || '');
  const [emailCountFilter, setEmailCountFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });
  const [filterOptions, setFilterOptions] = useState({
    companies: [] as string[],
    campaigns: [] as string[]
  });

  // Sync filters with URL search params when they change
  useEffect(() => {
    const companyParam = searchParams.get('company') || '';
    const campaignParam = searchParams.get('campaign') || '';
    if (companyParam && companyParam !== companyFilter) {
      setCompanyFilter(companyParam);
    }
    if (campaignParam && campaignParam !== campaignFilter) {
      setCampaignFilter(campaignParam);
    }
  }, [searchParams, companyFilter, campaignFilter]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
      setPagination(prev => ({ ...prev, page: 1 }));
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    fetchCampaignRuns();
  }, [pagination.page, pagination.limit, searchTerm, companyFilter, campaignFilter, emailCountFilter, sortBy, sortOrder]);

  const fetchCampaignRuns = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(companyFilter && { company: companyFilter }),
        ...(campaignFilter && { campaign: campaignFilter }),
        ...(emailCountFilter && { emailCountFilter }),
        ...(sortBy && { sortBy }),
        ...(sortOrder && { sortOrder })
      });
      
      const res = await fetch(`/api/campaign-runs?${params}`);
      const data = await res.json();
      
      if (data.campaignRuns) {
        setCampaignRuns(data.campaignRuns);
        setPagination(data.pagination);
        if (data.filters) {
          setFilterOptions(data.filters);
        }
      } else {
        setCampaignRuns([]);
      }
    } catch (err) {
      console.error('Failed to load campaign runs');
      setCampaignRuns([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleSearch = (value: string) => {
    setSearchInput(value);
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearchTerm('');
    setCompanyFilter('');
    setCampaignFilter('');
    setEmailCountFilter('');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPagination(prev => ({ ...prev, page: 1 }));
  };


  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Campaign Runs</h2>
          <p className="text-neutral-500">View all campaign execution runs across all companies.</p>
        </div>
        <div className="flex items-center gap-4 text-sm text-neutral-500 bg-white dark:bg-neutral-800 p-2 rounded-lg border">
          <div className="flex items-center gap-1 px-2">
            <Play size={16} />
            <span className="font-bold text-neutral-900">{pagination.total}</span> Total Runs
          </div>
          <div className="flex items-center gap-1 px-2 border-l">
            <span className="font-bold text-neutral-900">
              {campaignRuns.filter(r => !r.isDataStoredOnWarehouse).length}
            </span> Live
          </div>
          <div className="flex items-center gap-1 px-2 border-l">
            <span className="font-bold text-neutral-900">
              {campaignRuns.filter(r => r.isDataStoredOnWarehouse).length}
            </span> Archived
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle>Campaign Runs Management</CardTitle>
                <CardDescription>
                  {pagination.total > 0 ? `Showing ${campaignRuns.length} of ${pagination.total} campaign runs` : 'Search and filter campaign runs.'}
                </CardDescription>
              </div>
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 h-4 w-4" />
                <Input
                  placeholder="Search campaign runs..."
                  className="pl-10"
                  value={searchInput}
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
              
              <Select value={companyFilter || '__all__'} onValueChange={(value) => {
                setCompanyFilter(value === '__all__' ? '' : value);
                setPagination(prev => ({ ...prev, page: 1 }));
              }}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="__all__">All Companies</SelectItem>
                  {filterOptions.companies.map(company => (
                    <SelectItem key={company} value={company}>{company}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={campaignFilter || '__all__'} onValueChange={(value) => {
                setCampaignFilter(value === '__all__' ? '' : value);
                setPagination(prev => ({ ...prev, page: 1 }));
              }}>
                <SelectTrigger className="w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="__all__">All Campaigns</SelectItem>
                  {filterOptions.campaigns.map(campaign => (
                    <SelectItem key={campaign} value={campaign}>{campaign}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={emailCountFilter || 'all'} onValueChange={(value) => {
                setEmailCountFilter(value === 'all' ? '' : value);
                setPagination(prev => ({ ...prev, page: 1 }));
              }}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Email Count" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Counts</SelectItem>
                  <SelectItem value="0">No Emails</SelectItem>
                  <SelectItem value="1-10">1-10 Emails</SelectItem>
                  <SelectItem value="11-100">11-100 Emails</SelectItem>
                  <SelectItem value="101-1000">101-1000 Emails</SelectItem>
                  <SelectItem value="1000+">1000+ Emails</SelectItem>
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
                <TableHead className="pl-6">Campaign Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('emailsSentCount')}
                    className="h-auto p-0 font-semibold"
                  >
                    Emails Sent
                    {sortBy === 'emailsSentCount' && (
                      <span className="ml-1">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </Button>
                </TableHead>
                <TableHead>Data Status</TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('createdAt')}
                    className="h-auto p-0 font-semibold"
                  >
                    Created
                    {sortBy === 'createdAt' && (
                      <span className="ml-1">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </Button>
                </TableHead>
                <TableHead className="pl-8">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="pl-6"><Skeleton className="h-4 w-[150px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-[80px] rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                    <TableCell className="pl-8"><Skeleton className="h-8 w-24" /></TableCell>
                  </TableRow>
                ))
              ) : campaignRuns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-48 text-neutral-500">
                    <div className="flex flex-col items-center gap-2">
                      <Play size={40} className="text-neutral-300" />
                      <p>No campaign runs found matching your filters.</p>
                      <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                campaignRuns.map((run) => (
                  <TableRow key={run._id}>
                    <TableCell className="pl-6 font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                          <Play className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <div>{run.campaign?.campaignName || 'Unknown Campaign'}</div>
                          <div className="text-xs text-neutral-500">ID: {run._id.slice(-8)}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Building2 size={12} className="text-neutral-400" />
                        {run.company?.name || 'No Company'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center">
                          <Mail size={14} className="text-neutral-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-neutral-900">
                            {run.emailsSentCount.toLocaleString()}
                          </div>
                          {run.emailCounts && (run.emailCounts.cc > 0 || run.emailCounts.bcc > 0) && (
                            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                              <span>{run.emailCounts.to} TO</span>
                              {run.emailCounts.cc > 0 && (
                                <>
                                  <span className="text-neutral-300">•</span>
                                  <span>{run.emailCounts.cc} CC</span>
                                </>
                              )}
                              {run.emailCounts.bcc > 0 && (
                                <>
                                  <span className="text-neutral-300">•</span>
                                  <span>{run.emailCounts.bcc} BCC</span>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {run.isDataStoredOnWarehouse ? (
                          <>
                            <Database size={16} className="text-neutral-900" />
                            <Badge className="bg-neutral-900 text-white">Archived</Badge>
                          </>
                        ) : (
                          <>
                            <Play size={16} className="text-neutral-900" />
                            <Badge className="bg-neutral-900 text-white">Live</Badge>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1">
                        <Calendar size={12} className="text-neutral-400" />
                        {new Date(run.createdAt).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {new Date(run.createdAt).toLocaleTimeString()}
                      </div>
                    </TableCell>
                    <TableCell className="pl-8">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/dashboard/campaign-runs/${run._id}`)}
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
                Page {pagination.page} of {pagination.pages} ({pagination.total} total campaign runs)
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
