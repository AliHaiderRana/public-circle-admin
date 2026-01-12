'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, Users, Building2, Activity, Clock, CheckCircle, XCircle, AlertCircle, Mail, UserPlus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

interface ActivitySectionProps {
  campaignData: any;
  campaignLoading: boolean;
}

export default function ActivitySection({ campaignData, campaignLoading }: ActivitySectionProps) {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'campaign_run':
        return <Mail className="w-5 h-5 text-white" />;
      case 'customer_request':
        return <Activity className="w-5 h-5 text-white" />;
      case 'user_registration':
        return <UserPlus className="w-5 h-5 text-white" />;
      default:
        return <Target className="w-5 h-5 text-white" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'campaign_run':
        return 'from-purple-500 to-indigo-600';
      case 'customer_request':
        return 'from-orange-500 to-red-600';
      case 'user_registration':
        return 'from-green-500 to-emerald-600';
      default:
        return 'from-blue-500 to-cyan-600';
    }
  };

  const getActivityLabel = (type: string) => {
    switch (type) {
      case 'campaign_run':
        return 'Campaign Run';
      case 'customer_request':
        return 'Customer Request';
      case 'user_registration':
        return 'New User';
      default:
        return 'Activity';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'PENDING':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'REJECTED':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      case 'ACTIVE':
        return <Badge className="bg-blue-100 text-blue-800"><Activity className="w-3 h-3 mr-1" />Active</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
    }
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
          <p className="text-sm text-gray-500">Latest campaign runs, customer requests, and user registrations</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {campaignLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            ) : campaignData?.recentActivity && campaignData.recentActivity.length > 0 ? (
              campaignData.recentActivity.map((activity: any) => (
                <div key={activity._id} className="flex items-start gap-4 p-4 rounded-lg border hover:bg-neutral-50 transition-colors">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getActivityColor(activity.type)} flex items-center justify-center flex-shrink-0`}>
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-gray-500 uppercase">{getActivityLabel(activity.type)}</span>
                        </div>
                        <p className="text-sm font-medium text-gray-900">{activity.name}</p>
                        <p className="text-xs text-gray-500 mt-1">{activity.company?.name || 'Unknown Company'}</p>
                      </div>
                      {getStatusBadge(activity.status)}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>{formatDate(activity.createdAt || activity.updatedAt)}</span>
                      {activity.emailsSent && <span>• {activity.emailsSent.toLocaleString()} emails sent</span>}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No recent activity</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {campaignLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <>
              <Link href="/dashboard/users">
                <div className="w-full text-left px-4 py-3 rounded-lg border hover:bg-neutral-50 hover:border-neutral-300 transition-all cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Users className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Manage Users</p>
                      <p className="text-xs text-gray-500">View all users</p>
                    </div>
                  </div>
                </div>
              </Link>
              
              <Link href="/dashboard/campaigns">
                <div className="w-full text-left px-4 py-3 rounded-lg border hover:bg-neutral-50 hover:border-neutral-300 transition-all cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                      <Target className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Campaigns</p>
                      <p className="text-xs text-gray-500">View and manage</p>
                    </div>
                  </div>
                </div>
              </Link>
              
              <Link href="/dashboard/companies">
                <div className="w-full text-left px-4 py-3 rounded-lg border hover:bg-neutral-50 hover:border-neutral-300 transition-all cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Companies</p>
                      <p className="text-xs text-gray-500">Browse all</p>
                    </div>
                  </div>
                </div>
              </Link>
              
              <Link href="/dashboard/customer-requests">
                <div className="w-full text-left px-4 py-3 rounded-lg border hover:bg-neutral-50 hover:border-neutral-300 transition-all cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                      <Activity className="w-4 h-4 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Customer Requests</p>
                      <p className="text-xs text-gray-500">
                        {campaignData?.pendingRequests > 0 
                          ? `${campaignData.pendingRequests} pending` 
                          : 'No pending requests'
                        }
                      </p>
                    </div>
                    {campaignData?.pendingRequests > 0 && (
                      <Badge variant="destructive" className="text-xs">{campaignData.pendingRequests}</Badge>
                    )}
                  </div>
                </div>
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
