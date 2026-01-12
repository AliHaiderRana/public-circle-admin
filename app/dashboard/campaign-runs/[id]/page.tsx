'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  Mail, 
  Send, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  MousePointer, 
  Clock,
  Calendar,
  Building2,
  Play,
  Database,
  ChevronLeft,
  ChevronRight,
  Filter,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  RefreshCw,
  BarChart3
} from 'lucide-react';

interface CampaignRunDetail {
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
  createdAt: string;
  updatedAt: string;
  emailsSentCount?: number;
  emailCounts?: {
    total: number;
    to: number;
    cc: number;
    bcc: number;
  };
}

interface EmailRecord {
  _id: string;
  recipientEmailAddress: string;
  recipientType: string;
  emailSubject: string;
  fromEmailAddress: string;
  emailEvents: {
    Send?: { timestamp: string };
    Delivery?: { timestamp: string };
    Bounce?: { timestamp: string; bounceType?: string };
    Open?: { timestamp: string };
    Click?: { timestamp: string };
  };
  createdAt: string;
  resendCount?: number;
  cc?: any[];
  bcc?: any[];
  resent?: any[];
  allEmailIds?: string[];
}

 const getRecipientAddress = (email: Partial<EmailRecord> & Record<string, any>) => {
   return (
     email.recipientEmailAddress ||
     email.recipientEmail ||
     email.toEmailAddress ||
     email.to ||
     email.emailAddress ||
     email.recipient?.emailAddress ||
     email.recipient?.recipientEmailAddress ||
     ''
   );
 };

 const normalizeEmailList = (list: any[] | undefined) => {
   if (!Array.isArray(list)) return [];
   return list
     .map((item) => item?.recipientEmailAddress || item?.emailAddress || item)
     .filter((v) => typeof v === 'string' && v.trim() !== '');
 };

 const formatDateTime = (value: any) => {
   if (!value) return '—';
   const d = value instanceof Date ? value : new Date(value);
   if (Number.isNaN(d.getTime())) return '—';
   return new Intl.DateTimeFormat('en-US', {
     year: 'numeric',
     month: 'short',
     day: '2-digit',
     hour: '2-digit',
     minute: '2-digit'
   }).format(d);
 };

 const getBounceReason = (event: any) => {
   if (!event) return 'Bounce detected';
   const nested = event?.bounce || event?.Bounce || event?.notification?.bounce || undefined;
   const bouncedRecipient =
     (Array.isArray(event?.bouncedRecipients) ? event.bouncedRecipients[0] : undefined) ||
     (Array.isArray(nested?.bouncedRecipients) ? nested.bouncedRecipients[0] : undefined);

   const candidates = [
     event?.bounceType,
     event?.bounceSubType,
     nested?.bounceType,
     nested?.bounceSubType,
     event?.bounceReason,
     nested?.bounceReason,
     event?.reason,
     nested?.reason,
     bouncedRecipient?.diagnosticCode,
     event?.diagnosticCode,
     nested?.diagnosticCode,
     event?.smtpResponse,
     nested?.smtpResponse
   ].filter((v) => typeof v === 'string' && v.trim() !== '');

   if (candidates.length > 0) return candidates[0];
   return (
     'Bounce detected'
   );
 };

 const getBounceDiagnostic = (event: any) => {
   if (!event) return '';
   const nested = event?.bounce || event?.Bounce || event?.notification?.bounce || undefined;
   const bouncedRecipient =
     (Array.isArray(event?.bouncedRecipients) ? event.bouncedRecipients[0] : undefined) ||
     (Array.isArray(nested?.bouncedRecipients) ? nested.bouncedRecipients[0] : undefined);
   return (
     bouncedRecipient?.diagnosticCode ||
     event?.diagnosticCode ||
     nested?.diagnosticCode ||
     event?.smtpResponse ||
     nested?.smtpResponse ||
     ''
   );
 };

export default function CampaignRunDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [campaignRun, setCampaignRun] = useState<CampaignRunDetail | null>(null);
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventFilter, setEventFilter] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [tooltipExpanded, setTooltipExpanded] = useState<Record<string, boolean>>({});
  const [isWarehouseData, setIsWarehouseData] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });

  useEffect(() => {
    if (params.id) {
      fetchCampaignRunDetails();
    }
  }, [params.id, pagination.page, pagination.limit, eventFilter]);

  const fetchCampaignRunDetails = async () => {
    setLoading(true);
    try {
      const resolvedParams = await params;
      const campaignRunId = resolvedParams.id as string;
      
      console.log('Fetching campaign run with ID:', campaignRunId);
      
      // First get campaign run details to check if it's stored in warehouse
      const campaignRunRes = await fetch(`/api/campaign-runs/${campaignRunId}`);
      const campaignRunData = await campaignRunRes.json();
      
      console.log('Campaign run response:', campaignRunData);
      
      if (campaignRunData.campaignRun) {
        setCampaignRun(campaignRunData.campaignRun);
        setIsWarehouseData(campaignRunData.campaignRun.isDataStoredOnWarehouse);
        
        // Fetch emails from appropriate source
        await fetchEmails(campaignRunId, campaignRunData.campaignRun.isDataStoredOnWarehouse);
      } else {
        console.log('No campaign run found in response:', campaignRunData);
        setCampaignRun(null);
        setEmails([]);
      }
    } catch (err) {
      console.error('Failed to load campaign run details:', err);
      setCampaignRun(null);
      setEmails([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmails = async (campaignRunId: string, fromWarehouse: boolean) => {
    try {
      const params_search = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(eventFilter && { filter: eventFilter }),
        ...(fromWarehouse && { warehouse: 'true' })
      });
      
      const endpoint = fromWarehouse 
        ? `/api/campaign-runs/${campaignRunId}/warehouse?${params_search}`
        : `/api/campaign-runs/${campaignRunId}?${params_search}`;
      
      const res = await fetch(endpoint);
      const data = await res.json();
      
      if (data.emails || data.items) {
        setEmails(data.emails || data.items || []);
        setPagination(data.pagination || {
          page: 1,
          limit: 10,
          total: data.totalRecords || 0,
          pages: Math.ceil((data.totalRecords || 0) / 10)
        });
      } else {
        setEmails([]);
      }
    } catch (err) {
      console.error('Failed to load emails');
      setEmails([]);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const clearFilters = () => {
    setEventFilter('');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const filterTabValue = eventFilter || 'all';

  const handleFilterTabChange = (value: string) => {
    setEventFilter(value === 'all' ? '' : value);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const toggleRowExpansion = (emailId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(emailId)) {
        newSet.delete(emailId);
      } else {
        newSet.add(emailId);
      }
      return newSet;
    });
  };

  const toggleTooltipExpanded = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTooltipExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const hasEvent = (email: EmailRecord, eventType: string) => {
    return email.emailEvents && email.emailEvents[eventType as keyof typeof email.emailEvents];
  };

  const getEventBadge = (email: EmailRecord) => {
    const events = email.emailEvents || {};
    if (events.Bounce) {
      return <Badge className="bg-neutral-900 text-white">Failed</Badge>;
    } else if (events.Click) {
      return <Badge className="bg-neutral-900 text-white">Clicked</Badge>;
    } else if (events.Open) {
      return <Badge className="bg-neutral-900 text-white">Opened</Badge>;
    } else if (events.Delivery) {
      return <Badge className="bg-neutral-900 text-white">Delivered</Badge>;
    } else if (events.Send) {
      return <Badge className="bg-neutral-900 text-white">Sent</Badge>;
    }
    return <Badge variant="outline">Pending</Badge>;
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'Send':
        return <Send size={16} className="text-neutral-900" />;
      case 'Delivery':
        return <CheckCircle2 size={16} className="text-neutral-900" />;
      case 'Bounce':
        return <XCircle size={16} className="text-red-500" />;
      case 'Open':
        return <Eye size={16} className="text-blue-500" />;
      case 'Click':
        return <MousePointer size={16} className="text-purple-500" />;
      default:
        return <Clock size={16} className="text-gray-500" />;
    }
  };

  const getEventTime = (email: EmailRecord) => {
    const events = email.emailEvents || {};
    if (events.Click) return events.Click.timestamp;
    if (events.Open) return events.Open.timestamp;
    if (events.Bounce) return events.Bounce.timestamp;
    if (events.Delivery) return events.Delivery.timestamp;
    if (events.Send) return events.Send.timestamp;
    return email.createdAt;
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!campaignRun) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold text-gray-900">Campaign run not found</h2>
          <p className="text-gray-600 mt-2">The campaign run you're looking for doesn't exist.</p>
          <Button onClick={() => router.back()} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="p-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
              <Play className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {campaignRun.campaign?.campaignName || 'Unknown Campaign'}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                {campaignRun.isDataStoredOnWarehouse ? (
                  <Badge className="bg-neutral-900 text-white">Archived</Badge>
                ) : (
                  <Badge className="bg-neutral-900 text-white">Live</Badge>
                )}
                <span className="text-sm text-gray-500">
                  Run ID: {campaignRun._id.slice(-8)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Campaign Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Company</p>
                <p className="text-lg font-semibold text-gray-900">
                  {campaignRun.company?.name || 'Unknown Company'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <Mail className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Subject</p>
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {campaignRun.campaign?.emailSubject || 'No Subject'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Created</p>
                <p className="text-sm font-semibold text-gray-900">
                  {formatDateTime(campaignRun.createdAt)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Email Stats */}
        {(campaignRun.emailsSentCount || campaignRun.emailCounts) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Email Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {campaignRun.emailsSentCount || 0}
                  </div>
                  <div className="text-sm text-blue-800">Total Emails</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {campaignRun.emailCounts?.to || 0}
                  </div>
                  <div className="text-sm text-green-800">To</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {campaignRun.emailCounts?.cc || 0}
                  </div>
                  <div className="text-sm text-purple-800">CC</div>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {campaignRun.emailCounts?.bcc || 0}
                  </div>
                  <div className="text-sm text-orange-800">BCC</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

      {/* Filter Cards */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
        <Tabs value={filterTabValue} onValueChange={handleFilterTabChange}>
          <TabsList className="w-full md:w-auto overflow-x-auto justify-start">
            <TabsTrigger value="all" className="gap-2">
              All
              <Badge variant="secondary" className="h-5 px-2 text-[10px]">
                {pagination.total}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="emailsSent" className="gap-2">
              Sent
              <Badge variant="secondary" className="h-5 px-2 text-[10px]">
                {emails.filter(e => hasEvent(e, 'Send')).length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="emailsDelivered" className="gap-2">
              Delivered
              <Badge variant="secondary" className="h-5 px-2 text-[10px]">
                {emails.filter(e => hasEvent(e, 'Delivery')).length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="emailsFailed" className="gap-2">
              Failed
              <Badge variant="secondary" className="h-5 px-2 text-[10px]">
                {emails.filter(e => hasEvent(e, 'Bounce')).length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="emailsOpened" className="gap-2">
              Opened
              <Badge variant="secondary" className="h-5 px-2 text-[10px]">
                {emails.filter(e => hasEvent(e, 'Open')).length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="emailsClicked" className="gap-2">
              Clicked
              <Badge variant="secondary" className="h-5 px-2 text-[10px]">
                {emails.filter(e => hasEvent(e, 'Click')).length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-3">
          {isWarehouseData && (
            <div className="flex items-center gap-2 text-sm text-neutral-600">
              <Database size={16} className="text-neutral-500" />
              <span>Warehouse Data</span>
            </div>
          )}
          <Button variant="outline" onClick={clearFilters}>
            Clear
          </Button>
        </div>
      </div>

      {/* Email Records Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Recipient</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="pl-6"><Skeleton className="h-4 w-[180px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-[80px] rounded-full" /></TableCell>
                    <TableCell className="text-right pr-6"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : emails.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center h-48 text-neutral-500">
                    <div className="flex flex-col items-center gap-2">
                      <Mail size={40} className="text-neutral-300" />
                      <p>No email records found matching your filters.</p>
                      <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                emails.map((email) => (
                  <React.Fragment key={email._id}>
                    <TableRow className="cursor-pointer hover:bg-gray-50" onClick={() => toggleRowExpansion(email._id)}>
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-2 min-w-0">
                          <Mail size={16} className="text-neutral-400" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="font-medium truncate max-w-[260px] sm:max-w-[360px]">
                                {getRecipientAddress(email) || '—'}
                              </div>
                              <div className="flex items-center gap-1 flex-wrap">
                                {normalizeEmailList(email.cc).length > 0 && (
                                  <span className="relative group inline-flex">
                                    {(() => {
                                      const list = normalizeEmailList(email.cc);
                                      const key = `${email._id}-cc`;
                                      const expanded = !!tooltipExpanded[key];
                                      const visible = expanded ? list : list.slice(0, 10);
                                      return (
                                        <>
                                          <Badge
                                            variant="secondary"
                                            className="h-5 px-2 text-[10px] font-medium"
                                          >
                                            CC {normalizeEmailList(email.cc).length}
                                          </Badge>
                                          <div className="pointer-events-auto absolute left-0 top-full z-50 mt-1 hidden w-72 rounded-md border bg-white p-2 text-[11px] text-neutral-900 shadow-md group-hover:block">
                                            <div className="font-semibold mb-1">CC</div>
                                            <div className={expanded ? 'max-h-48 overflow-y-auto pr-1 space-y-0.5' : 'space-y-0.5'}>
                                              {visible.map((addr) => (
                                                <div key={addr} className="truncate">{addr}</div>
                                              ))}
                                            </div>
                                            {!expanded && list.length > 10 && (
                                              <button
                                                type="button"
                                                className="mt-2 w-full rounded-md border px-2 py-1 text-[11px] font-medium text-neutral-900 hover:bg-neutral-50"
                                                onClick={(e) => toggleTooltipExpanded(key, e)}
                                              >
                                                View all 10+
                                              </button>
                                            )}
                                            {expanded && (
                                              <button
                                                type="button"
                                                className="mt-2 w-full rounded-md border px-2 py-1 text-[11px] font-medium text-neutral-900 hover:bg-neutral-50"
                                                onClick={(e) => toggleTooltipExpanded(key, e)}
                                              >
                                                Show less
                                              </button>
                                            )}
                                          </div>
                                        </>
                                      );
                                    })()}
                                  </span>
                                )}
                                {normalizeEmailList(email.bcc).length > 0 && (
                                  <span className="relative group inline-flex">
                                    {(() => {
                                      const list = normalizeEmailList(email.bcc);
                                      const key = `${email._id}-bcc`;
                                      const expanded = !!tooltipExpanded[key];
                                      const visible = expanded ? list : list.slice(0, 10);
                                      return (
                                        <>
                                          <Badge
                                            variant="secondary"
                                            className="h-5 px-2 text-[10px] font-medium"
                                          >
                                            BCC {normalizeEmailList(email.bcc).length}
                                          </Badge>
                                          <div className="pointer-events-auto absolute left-0 top-full z-50 mt-1 hidden w-72 rounded-md border bg-white p-2 text-[11px] text-neutral-900 shadow-md group-hover:block">
                                            <div className="font-semibold mb-1">BCC</div>
                                            <div className={expanded ? 'max-h-48 overflow-y-auto pr-1 space-y-0.5' : 'space-y-0.5'}>
                                              {visible.map((addr) => (
                                                <div key={addr} className="truncate">{addr}</div>
                                              ))}
                                            </div>
                                            {!expanded && list.length > 10 && (
                                              <button
                                                type="button"
                                                className="mt-2 w-full rounded-md border px-2 py-1 text-[11px] font-medium text-neutral-900 hover:bg-neutral-50"
                                                onClick={(e) => toggleTooltipExpanded(key, e)}
                                              >
                                                View all 10+
                                              </button>
                                            )}
                                            {expanded && (
                                              <button
                                                type="button"
                                                className="mt-2 w-full rounded-md border px-2 py-1 text-[11px] font-medium text-neutral-900 hover:bg-neutral-50"
                                                onClick={(e) => toggleTooltipExpanded(key, e)}
                                              >
                                                Show less
                                              </button>
                                            )}
                                          </div>
                                        </>
                                      );
                                    })()}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-xs text-neutral-500">To: {getRecipientAddress(email) || '—'}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={email.emailSubject}>
                        {email.emailSubject}
                      </TableCell>
                      <TableCell>
                        {getEventBadge(email)}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Button variant="ghost" size="sm">
                          {expandedRows.has(email._id) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </Button>
                      </TableCell>
                    </TableRow>
                    
                    {/* Expanded Row with Event Details */}
                    {expandedRows.has(email._id) && (
                      <TableRow>
                        <TableCell colSpan={4} className="p-0">
                          <div className="bg-gray-50 p-6 border-l-4 border-blue-500">
                            <div className="space-y-4">
                              <div className="flex items-center gap-2 font-semibold text-gray-900">
                                <Clock size={16} className="text-blue-500" />
                                Email Event Timeline
                              </div>
                              
                              {Object.entries(email.emailEvents).map(([eventType, event]) => (
                                <div key={eventType} className="flex items-start gap-4 p-3 bg-white rounded-lg border">
                                  <div className="mt-1">
                                    {getEventIcon(eventType)}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-medium capitalize">{eventType}</span>
                                      {formatDateTime(event?.timestamp) !== '—' && (
                                        <Badge variant="outline" className="text-xs">
                                          {formatDateTime(event?.timestamp)}
                                        </Badge>
                                      )}
                                    </div>
                                    {eventType === 'Bounce' && (
                                      <div className="space-y-1">
                                        <div className="text-sm text-red-600">
                                          Bounce Reason: {getBounceReason(event)}
                                        </div>
                                        {getBounceDiagnostic(event) && (
                                          <div className="text-xs text-neutral-600 break-words">
                                            {getBounceDiagnostic(event)}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    {eventType === 'Send' && (
                                      <div className="text-sm text-gray-600">
                                        Email sent successfully to {getRecipientAddress(email) || '—'}
                                      </div>
                                    )}
                                    {eventType === 'Delivery' && (
                                      <div className="text-sm text-gray-600">
                                        Email delivered to recipient's mail server
                                      </div>
                                    )}
                                    {eventType === 'Open' && (
                                      <div className="text-sm text-blue-600">
                                        Email was opened by recipient
                                      </div>
                                    )}
                                    {eventType === 'Click' && (
                                      <div className="text-sm text-purple-600">
                                        Recipient clicked on email links
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                              
                              {email.cc && email.cc.length > 0 && (
                                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                                  <div className="text-sm font-medium text-blue-800">CC Recipients:</div>
                                  <div className="text-sm text-blue-600">
                                    {email.cc.map((cc: any) => cc.recipientEmailAddress || cc.emailAddress || cc).join(', ')}
                                  </div>
                                  <div className="text-xs text-blue-500 mt-1">{email.cc.length} recipient(s)</div>
                                </div>
                              )}
                              
                              {email.bcc && email.bcc.length > 0 && (
                                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                                  <div className="text-sm font-medium text-purple-800">BCC Recipients:</div>
                                  <div className="text-sm text-purple-600">
                                    {email.bcc.map((bcc: any) => bcc.recipientEmailAddress || bcc.emailAddress || bcc).join(', ')}
                                  </div>
                                  <div className="text-xs text-purple-500 mt-1">{email.bcc.length} recipient(s)</div>
                                </div>
                              )}
                              
                              {email.resendCount && email.resendCount > 0 && (
                                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                                  <div className="flex items-center gap-2 text-sm font-medium text-orange-800">
                                    <RefreshCw size={16} />
                                    Resent {email.resendCount} time(s)
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
      
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 border-t">
          <div className="text-sm text-neutral-500">
            Page {pagination.page} of {pagination.pages} ({pagination.total} total emails)
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

  const getFilteredEmails = (emails: EmailRecord[], eventFilter: string) => {
    return emails.filter(email => {
      if (eventFilter === '') return true;
      if (eventFilter === 'emailsSent') return hasEvent(email, 'Send');
      if (eventFilter === 'emailsDelivered') return hasEvent(email, 'Delivery');
      if (eventFilter === 'emailsFailed') return hasEvent(email, 'Bounce');
      if (eventFilter === 'emailsOpened') return hasEvent(email, 'Open');
      if (eventFilter === 'emailsClicked') return hasEvent(email, 'Click');
      return true;
    });
  };
}
