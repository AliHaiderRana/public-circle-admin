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
        return <Mail className="w-5 h-5 text-muted-foreground" />;
      case 'customer_request':
        return <Activity className="w-5 h-5 text-muted-foreground" />;
      case 'user_registration':
        return <UserPlus className="w-5 h-5 text-muted-foreground" />;
      default:
        return <Target className="w-5 h-5 text-muted-foreground" />;
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

  const getStatusBadge = (status: string | undefined) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'SENT':
        return <Badge><CheckCircle className="w-3 h-3 mr-1" />Sent</Badge>;
      case 'PENDING':
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      case 'ACTIVE':
        return <Badge><Activity className="w-3 h-3 mr-1" />Active</Badge>;
      case 'PAUSED':
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Paused</Badge>;
      default:
        return status ? <Badge variant="secondary">{status}</Badge> : null;
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
          <p className="text-sm text-muted-foreground">Latest campaign runs, customer requests, and user registrations</p>
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
                <div key={activity._id} className="flex items-start gap-4 p-4 rounded-lg border hover:bg-accent transition-colors">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-muted-foreground uppercase">{getActivityLabel(activity.type)}</span>
                        </div>
                        <p className="text-sm font-medium text-foreground">{activity.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{activity.company?.name || 'Unknown Company'}</p>
                      </div>
                      {getStatusBadge(activity.status)}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>{formatDate(activity.createdAt || activity.updatedAt)}</span>
                      {activity.emailsSent && <span>• {activity.emailsSent.toLocaleString()} emails sent</span>}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <Activity className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">No recent activity</p>
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
        <CardContent className="space-y-4">
          {campaignLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Link href="/dashboard/users" className="block">
                <Card className="px-4 py-3 hover:bg-accent transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                      <Users className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Manage Users</p>
                      <p className="text-xs text-muted-foreground">View all users</p>
                    </div>
                  </div>
                </Card>
              </Link>

              <Link href="/dashboard/campaigns" className="block">
                <Card className="px-4 py-3 hover:bg-accent transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                      <Target className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Campaigns</p>
                      <p className="text-xs text-muted-foreground">View and manage</p>
                    </div>
                  </div>
                </Card>
              </Link>

              <Link href="/dashboard/companies" className="block">
                <Card className="px-4 py-3 hover:bg-accent transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Companies</p>
                      <p className="text-xs text-muted-foreground">Browse all</p>
                    </div>
                  </div>
                </Card>
              </Link>

              <Link href="/dashboard/customer-requests" className="block">
                <Card className="px-4 py-3 hover:bg-accent transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                      <Activity className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Customer Requests</p>
                      <p className="text-xs text-muted-foreground">
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
                </Card>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
