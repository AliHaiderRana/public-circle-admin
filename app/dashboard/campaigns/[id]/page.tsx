'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
          <h2 className="text-2xl font-semibold text-gray-900">Campaign not found</h2>
          <p className="text-gray-600 mt-2">The campaign you're looking for doesn't exist.</p>
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
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center border border-gray-200">
              <Send className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {campaign.campaignName}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                {getStatusBadge(campaign.status)}
                <span className="text-sm text-gray-500">
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
      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          We're maintaining only 30 records for each campaign run. Historical data beyond the most recent 30 records will not be available.
        </AlertDescription>
      </Alert>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-lg transition-shadow duration-200 border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Send className="h-4 w-4 text-blue-500" />
                  Emails Processed
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {campaign.processedCount || 0}
                </p>
              </div>
              <div className="h-14 w-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <Send className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow duration-200 border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-green-500" />
                  Total Recipients
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {(campaign.cc?.length || 0) + (campaign.bcc?.length || 0)}
                </p>
                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-xs text-gray-600 font-medium">
                      CC: {campaign.cc?.length || 0}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span className="text-xs text-gray-600 font-medium">
                      BCC: {campaign.bcc?.length || 0}
                    </span>
                  </div>
                </div>
              </div>
              <div className="h-14 w-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                <BarChart3 className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow duration-200 border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-500" />
                  Segments
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {campaign.segments?.length || 0}
                </p>
              </div>
              <div className="h-14 w-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Users className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow duration-200 border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-orange-500" />
                  Company
                </p>
                <p className="text-lg font-bold text-gray-900 mt-2 truncate">
                  {campaign.company.name}
                </p>
              </div>
              <div className="h-14 w-14 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                <Building2 className="h-7 w-7 text-white" />
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
              <label className="text-sm font-medium text-gray-700">Subject Line</label>
              <p className="mt-1 text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">
                {campaign.emailSubject}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Source Email</label>
              <p className="mt-1 text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">
                {campaign.sourceEmailAddress}
              </p>
            </div>
            {campaign.replyToEmailAddress && (
              <div>
                <label className="text-sm font-medium text-gray-700">Reply To Email</label>
                <p className="mt-1 text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">
                  {campaign.replyToEmailAddress}
                </p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-700">CC Recipients</label>
              <p className="mt-1 text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">
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
              <label className="text-sm font-medium text-gray-700">BCC Recipients</label>
              <p className="mt-1 text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">
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
                <Calendar size={16} className="text-gray-500" />
                <span className="text-sm font-medium">Created</span>
              </div>
              <span className="text-sm text-gray-900">
                {new Date(campaign.createdAt).toLocaleDateString()} at {new Date(campaign.createdAt).toLocaleTimeString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-gray-500" />
                <span className="text-sm font-medium">Last Updated</span>
              </div>
              <span className="text-sm text-gray-900">
                {new Date(campaign.updatedAt).toLocaleDateString()} at {new Date(campaign.updatedAt).toLocaleTimeString()}
              </span>
            </div>
            {campaign.lastProcessed && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Play size={16} className="text-gray-500" />
                  <span className="text-sm font-medium">Last Processed</span>
                </div>
                <span className="text-sm text-gray-900">
                  {new Date(campaign.lastProcessed).toLocaleDateString()} at {new Date(campaign.lastProcessed).toLocaleTimeString()}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-gray-500" />
                <span className="text-sm font-medium">Company</span>
              </div>
              <span className="text-sm text-gray-900">{campaign.company.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send size={16} className="text-gray-500" />
                <span className="text-sm font-medium">Run Mode</span>
              </div>
              <span className="text-sm text-gray-900">{campaign.runMode}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-gray-500" />
                <span className="text-sm font-medium">Frequency</span>
              </div>
              <span className="text-sm text-gray-900">{campaign.frequency}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-gray-500" />
                <span className="text-sm font-medium">Cron Status</span>
              </div>
              <span className="text-sm text-gray-900">{campaign.cronStatus}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
