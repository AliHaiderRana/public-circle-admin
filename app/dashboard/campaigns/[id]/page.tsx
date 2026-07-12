'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  ArrowLeft, 
  Send, 
  Mail, 
  Calendar, 
  Building2, 
  Users,
  Play,
  BarChart3,
  Clock,
  CheckCircle2,
  Info
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CampaignDetail {
  _id: string;
  campaignName: string;
  emailSubject: string;
  status: string;
  company: {
    _id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
  sourceEmailAddress: string;
  replyToEmailAddress?: string;
  emailTemplate?: string;
  cc: string[];
  bcc: string[];
  processedCount: number;
  segments: string[];
  lastProcessed?: string;
  cronStatus: string;
  frequency: string;
  runMode: string;
  isRecurring: boolean;
  isOnGoing: boolean;
  description?: string;
  campaignRunsCount?: number;
}

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      fetchCampaignDetails();
    }
  }, [params.id]);

  const fetchCampaignDetails = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/campaigns/${params.id}`);
      if (!response.ok) throw new Error('Failed to fetch campaign details');
      
      const data = await response.json();
      setCampaign(data.campaign);
    } catch (error) {
      console.error('Error fetching campaign details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge>Active</Badge>;
      case 'PAUSED':
        return <Badge variant="outline">Paused</Badge>;
      case 'DRAFT':
        return <Badge variant="secondary">Draft</Badge>;
      case 'ARCHIVED':
        return <Badge variant="secondary">Archived</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold text-foreground">Campaign not found</h2>
          <p className="text-muted-foreground mt-2">The campaign you're looking for doesn't exist.</p>
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
            <Avatar className="h-12 w-12">
              <AvatarFallback>
                <Send className="h-6 w-6" />
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {campaign.campaignName}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                {getStatusBadge(campaign.status)}
                <span className="text-sm text-muted-foreground">
                  Created {new Date(campaign.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>
        <Button 
          onClick={() => router.push(`/dashboard/campaign-runs?company=${campaign.company._id}&campaign=${campaign._id}`)}
          className="flex items-center gap-2"
        >
          <Play className="h-4 w-4" />
          View Campaign Runs
        </Button>
      </div>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          We're maintaining only 30 records for each campaign run. Historical data beyond the most recent 30 records will not be available.
        </AlertDescription>
      </Alert>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <Send className="h-4 w-4 text-muted-foreground" />
                  Emails Processed
                </p>
                <p className="text-3xl font-bold text-foreground mt-2">
                  {campaign.processedCount || 0}
                </p>
              </div>
              <div className="h-14 w-14 bg-muted rounded-lg flex items-center justify-center">
                <Send className="h-7 w-7 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  Total Recipients
                </p>
                <p className="text-3xl font-bold text-foreground mt-2">
                  {(campaign.cc?.length || 0) + (campaign.bcc?.length || 0)}
                </p>
                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span className="text-xs text-muted-foreground font-medium">
                      CC: {campaign.cc?.length || 0}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span className="text-xs text-muted-foreground font-medium">
                      BCC: {campaign.bcc?.length || 0}
                    </span>
                  </div>
                </div>
              </div>
              <div className="h-14 w-14 bg-muted rounded-lg flex items-center justify-center">
                <BarChart3 className="h-7 w-7 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Segments
                </p>
                <p className="text-3xl font-bold text-foreground mt-2">
                  {campaign.segments?.length || 0}
                </p>
              </div>
              <div className="h-14 w-14 bg-muted rounded-lg flex items-center justify-center">
                <Users className="h-7 w-7 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <Play className="h-4 w-4 text-muted-foreground" />
                  Campaign Runs
                </p>
                <p className="text-3xl font-bold text-foreground mt-2">
                  {campaign.campaignRunsCount || 0}
                </p>
              </div>
              <div className="h-14 w-14 bg-muted rounded-lg flex items-center justify-center">
                <Play className="h-7 w-7 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Company
                </p>
                <p className="text-lg font-bold text-foreground mt-2 truncate">
                  {campaign.company.name}
                </p>
              </div>
              <div className="h-14 w-14 bg-muted rounded-lg flex items-center justify-center">
                <Building2 className="h-7 w-7 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaign Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Subject Line</label>
              <p className="mt-1 text-sm text-foreground bg-muted p-3 rounded-lg">
                {campaign.emailSubject}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Source Email</label>
              <p className="mt-1 text-sm text-foreground bg-muted p-3 rounded-lg">
                {campaign.sourceEmailAddress}
              </p>
            </div>
            {campaign.replyToEmailAddress && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Reply To Email</label>
                <p className="mt-1 text-sm text-foreground bg-muted p-3 rounded-lg">
                  {campaign.replyToEmailAddress}
                </p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-muted-foreground">CC Recipients</label>
              <p className="mt-1 text-sm text-foreground bg-muted p-3 rounded-lg">
                {campaign.cc?.length || 0} recipients
                {campaign.cc && campaign.cc.length > 0 && (
                  <div className="mt-2 max-h-20 overflow-y-auto text-xs">
                    {campaign.cc.slice(0, 10).join(', ')}
                    {campaign.cc.length > 10 && ` ... and ${campaign.cc.length - 10} more`}
                  </div>
                )}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">BCC Recipients</label>
              <p className="mt-1 text-sm text-foreground bg-muted p-3 rounded-lg">
                {campaign.bcc?.length || 0} recipients
                {campaign.bcc && campaign.bcc.length > 0 && (
                  <div className="mt-2 max-h-20 overflow-y-auto text-xs">
                    {campaign.bcc.slice(0, 10).join(', ')}
                    {campaign.bcc.length > 10 && ` ... and ${campaign.bcc.length - 10} more`}
                  </div>
                )}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-muted-foreground" />
                <span className="text-sm font-medium">Created</span>
              </div>
              <span className="text-sm text-foreground">
                {new Date(campaign.createdAt).toLocaleDateString()} at {new Date(campaign.createdAt).toLocaleTimeString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-muted-foreground" />
                <span className="text-sm font-medium">Last Updated</span>
              </div>
              <span className="text-sm text-foreground">
                {new Date(campaign.updatedAt).toLocaleDateString()} at {new Date(campaign.updatedAt).toLocaleTimeString()}
              </span>
            </div>
            {campaign.lastProcessed && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Play size={16} className="text-muted-foreground" />
                  <span className="text-sm font-medium">Last Processed</span>
                </div>
                <span className="text-sm text-foreground">
                  {new Date(campaign.lastProcessed).toLocaleDateString()} at {new Date(campaign.lastProcessed).toLocaleTimeString()}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-muted-foreground" />
                <span className="text-sm font-medium">Company</span>
              </div>
              <span className="text-sm text-foreground">{campaign.company.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send size={16} className="text-muted-foreground" />
                <span className="text-sm font-medium">Run Mode</span>
              </div>
              <span className="text-sm text-foreground">{campaign.runMode}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-muted-foreground" />
                <span className="text-sm font-medium">Frequency</span>
              </div>
              <span className="text-sm text-foreground">{campaign.frequency}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-muted-foreground" />
                <span className="text-sm font-medium">Cron Status</span>
              </div>
              <span className="text-sm text-foreground">{campaign.cronStatus}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
