'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Users, Settings, TrendingUp, Mail, Target, Activity, ArrowUp, ArrowDown, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { useEffect, useState } from 'react';
import BounceRateCard from '@/components/BounceRateCard';
import ComplaintRateCard from '@/components/ComplaintRateCard';
import IndividualStatsCard from '@/components/IndividualStatsCard';
import ActivitySection from '@/components/ActivitySection';
import { StatsCardSkeleton, ReputationCardSkeleton, ActivityCardSkeleton, QuickActionsCardSkeleton, AlertSkeleton, TabsSkeleton } from '@/components/SkeletonLoaders';
import RefreshButton from '@/components/RefreshButton';

const stats = [
  { name: 'Total Companies', value: '128', icon: Building2, change: '+12%', changeType: 'increase' },
  { name: 'Active Users', value: '2,451', icon: Users, change: '+5.4%', changeType: 'increase' },
  { name: 'Pending Approvals', value: '14', icon: TrendingUp, change: '-3', changeType: 'decrease' },
  { name: 'System Status', value: 'Healthy', icon: Settings, change: '100%', changeType: 'neutral' },
];

interface AccountData {
  companyCount: number;
  activeCompanyCount: number;
  userCount: number;
  activeUserCount: number;
}

interface CampaignData {
  pendingRequests: number;
  completedRequests: number;
  rejectedRequests: number;
  activeCampaigns: number;
  totalCampaigns: number;
  recentActivity: any[];
}

interface EmailData {
  thisMonthEmails: number;
  lastMonthEmails: number;
  totalEmails: number;
  emailGrowth: number;
}

interface ReputationData {
  bounceRate: number;
  complaintRate: number;
  bouncedEmails: number;
  complainedEmails: number;
  deliveredEmails: number;
  reputationData: any[];
  status: 'Healthy' | 'Warning' | 'Account at risk';
}

export default function DashboardPage() {
  const [refreshing, setRefreshing] = useState(false);
  const [accountLoading, setAccountLoading] = useState(true);
  const [campaignLoading, setCampaignLoading] = useState(true);
  const [emailLoading, setEmailLoading] = useState(true);
  const [reputationLoading, setReputationLoading] = useState(true);
  const [accountData, setAccountData] = useState<AccountData | null>(null);
  const [campaignData, setCampaignData] = useState<CampaignData | null>(null);
  const [emailData, setEmailData] = useState<EmailData | null>(null);
  const [reputationData, setReputationData] = useState<ReputationData | null>(null);

  const fetchAccountData = async () => {
    setAccountLoading(true);
    try {
      const res = await fetch('/api/stats/account');
      if (res.ok) {
        const data = await res.json();
        setAccountData(data);
      }
    } catch (error) {
      console.error('Failed to fetch account stats:', error);
      setAccountData(null);
    } finally {
      setAccountLoading(false);
    }
  };

  const fetchCampaignData = async () => {
    setCampaignLoading(true);
    try {
      const res = await fetch('/api/stats/campaigns');
      if (res.ok) {
        const data = await res.json();
        setCampaignData(data);
      }
    } catch (error) {
      console.error('Failed to fetch campaign stats:', error);
      setCampaignData(null);
    } finally {
      setCampaignLoading(false);
    }
  };

  const fetchEmailData = async () => {
    setEmailLoading(true);
    try {
      const res = await fetch('/api/stats/emails');
      if (res.ok) {
        const data = await res.json();
        setEmailData(data);
      }
    } catch (error) {
      console.error('Failed to fetch email stats:', error);
      setEmailData(null);
    } finally {
      setEmailLoading(false);
    }
  };

  const fetchReputationData = async () => {
    setReputationLoading(true);
    try {
      const res = await fetch('/api/stats/reputation');
      if (res.ok) {
        const data = await res.json();
        setReputationData(data);
      }
    } catch (error) {
      console.error('Failed to fetch reputation stats:', error);
      setReputationData(null);
    } finally {
      setReputationLoading(false);
    }
  };

  const fetchAllData = async () => {
    // Fetch all data in parallel but don't wait for all to complete
    await Promise.all([
      fetchAccountData(),
      fetchCampaignData(),
      fetchEmailData(),
      fetchReputationData()
    ]);
    setRefreshing(false);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAllData();
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const isLoading = accountLoading || campaignLoading || emailLoading || reputationLoading;

  const statsList = [
    { 
      name: 'Total Companies', 
      value: accountData?.companyCount?.toLocaleString() || '0', 
      icon: Building2, 
      change: '+12%', 
      changeType: 'increase',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    { 
      name: 'Active Users', 
      value: accountData?.userCount?.toLocaleString() || '0', 
      icon: Users, 
      change: '+5.4%', 
      changeType: 'increase',
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    { 
      name: 'Active Campaigns', 
      value: campaignData?.activeCampaigns?.toLocaleString() || '0', 
      icon: Target, 
      change: 'Live now', 
      changeType: 'neutral',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    { 
      name: 'Pending Requests', 
      value: campaignData?.pendingRequests?.toLocaleString() || '0', 
      icon: Activity, 
      change: 'Requires Action', 
      changeType: 'decrease',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    { 
      name: 'Emails This Month', 
      value: emailData?.thisMonthEmails?.toLocaleString() || '0', 
      icon: Mail, 
      change: emailData && emailData.emailGrowth > 0 ? `+${emailData.emailGrowth}%` : `${emailData?.emailGrowth ?? 0}%`,
      changeType: (emailData?.emailGrowth ?? 0) > 0 ? 'increase' : (emailData?.emailGrowth ?? 0) < 0 ? 'decrease' : 'neutral',
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-50'
    },
    { 
      name: 'Total Campaigns', 
      value: campaignData?.totalCampaigns?.toLocaleString() || '0', 
      icon: TrendingUp, 
      change: 'All time', 
      changeType: 'neutral',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50'
    }
  ];

  const formatChange = (change: string, type: string) => {
    const isPositive = type === 'increase';
    const isNegative = type === 'decrease';
    
    if (isPositive) {
      return (
        <div className="flex items-center text-green-600">
          <ArrowUp className="w-4 h-4 mr-1" />
          <span className="text-sm font-medium">{change}</span>
        </div>
      );
    } else if (isNegative) {
      return (
        <div className="flex items-center text-red-600">
          <ArrowDown className="w-4 h-4 mr-1" />
          <span className="text-sm font-medium">{change}</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center text-gray-600">
          <span className="text-sm font-medium">{change}</span>
        </div>
      );
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">Dashboard Overview</h1>
          <p className="text-gray-500 mt-2">Welcome back! Here's what's happening across your platform today.</p>
        </div>
        <RefreshButton onRefresh={handleRefresh} isLoading={refreshing} />
      </div>

      {/* System Status Alert */}
      {reputationLoading ? (
        <AlertSkeleton />
      ) : reputationData ? (
        <Alert className={reputationData.status === 'Healthy' ? 'border-green-200 bg-green-50' : reputationData.status === 'Warning' ? 'border-yellow-200 bg-yellow-50' : 'border-red-200 bg-red-50'}>
          {reputationData.status === 'Healthy' ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : reputationData.status === 'Warning' ? (
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-600" />
          )}
          <AlertTitle className={reputationData.status === 'Healthy' ? 'text-green-800' : reputationData.status === 'Warning' ? 'text-yellow-800' : 'text-red-800'}>
            Email Reputation: {reputationData.status}
          </AlertTitle>
          <AlertDescription className={reputationData.status === 'Healthy' ? 'text-green-700' : reputationData.status === 'Warning' ? 'text-yellow-700' : 'text-red-700'}>
            {reputationData.status === 'Healthy' 
              ? 'Your email reputation is excellent. Continue maintaining good sending practices.'
              : reputationData.status === 'Warning'
              ? 'Some issues detected. Monitor your bounce and complaint rates closely.'
              : 'Immediate attention required. Your account reputation is at risk.'
            }
          </AlertDescription>
        </Alert>
      ) : null}

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
          {/* Stats Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Companies Card */}
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:shadow-lg transition-shadow duration-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-600">Companies</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {accountLoading ? (
                        <span className="inline-block h-8 w-16 bg-blue-200 rounded animate-pulse"></span>
                      ) : (
                        accountData?.companyCount?.toLocaleString() || '0'
                      )}
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
                      {accountLoading ? (
                        <span className="inline-block h-4 w-12 bg-blue-200 rounded animate-pulse"></span>
                      ) : (
                        `${accountData?.activeCompanyCount?.toLocaleString() || '0'} active`
                      )}
                    </p>
                  </div>
                  <div className="p-3 bg-blue-200 rounded-full">
                    <Building2 className="w-6 h-6 text-blue-700" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Users Card */}
            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:shadow-lg transition-shadow duration-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-600">Users</p>
                    <p className="text-2xl font-bold text-green-900">
                      {accountLoading ? (
                        <span className="inline-block h-8 w-16 bg-green-200 rounded animate-pulse"></span>
                      ) : (
                        accountData?.userCount?.toLocaleString() || '0'
                      )}
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      {accountLoading ? (
                        <span className="inline-block h-4 w-12 bg-green-200 rounded animate-pulse"></span>
                      ) : (
                        `${accountData?.activeUserCount?.toLocaleString() || '0'} active`
                      )}
                    </p>
                  </div>
                  <div className="p-3 bg-green-200 rounded-full">
                    <Users className="w-6 h-6 text-green-700" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Campaigns Card */}
            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 hover:shadow-lg transition-shadow duration-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-purple-600">Campaigns</p>
                    <p className="text-2xl font-bold text-purple-900">
                      {campaignLoading ? (
                        <span className="inline-block h-8 w-16 bg-purple-200 rounded animate-pulse"></span>
                      ) : (
                        campaignData?.totalCampaigns?.toLocaleString() || '0'
                      )}
                    </p>
                    <p className="text-xs text-purple-700 mt-1">
                      {campaignLoading ? (
                        <span className="inline-block h-4 w-12 bg-purple-200 rounded animate-pulse"></span>
                      ) : (
                        `${campaignData?.activeCampaigns?.toLocaleString() || '0'} active`
                      )}
                    </p>
                  </div>
                  <div className="p-3 bg-purple-200 rounded-full">
                    <Target className="w-6 h-6 text-purple-700" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Emails Card */}
            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 hover:shadow-lg transition-shadow duration-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-orange-600">Emails</p>
                    <p className="text-2xl font-bold text-orange-900">
                      {emailLoading ? (
                        <div className="h-8 w-16 bg-orange-200 rounded animate-pulse"></div>
                      ) : (
                        emailData?.thisMonthEmails?.toLocaleString() || '0'
                      )}
                    </p>
                    <p className="text-xs text-orange-700 mt-1">
                      {emailLoading ? (
                        <div className="h-4 w-12 bg-orange-200 rounded animate-pulse"></div>
                      ) : (
                        `This month${emailData && emailData.emailGrowth > 0 ? ` (+${emailData.emailGrowth}%)` : ''}`
                      )}
                    </p>
                  </div>
                  <div className="p-3 bg-orange-200 rounded-full">
                    <Mail className="w-6 h-6 text-orange-700" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Requests Status Grid */}
          <Card className="bg-white border border-gray-200">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Requests Status</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-center space-x-3 p-4 bg-green-50 rounded-lg border border-green-200 hover:bg-green-100 transition-colors duration-200">
                  <CheckCircle className="w-8 h-8 text-green-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-800">Completed</p>
                    <p className="text-2xl font-bold text-green-900">
                      {campaignLoading ? (
                        <div className="h-8 w-16 bg-green-200 rounded animate-pulse"></div>
                      ) : (
                        campaignData?.completedRequests?.toLocaleString() || '0'
                      )}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3 p-4 bg-yellow-50 rounded-lg border border-yellow-200 hover:bg-yellow-100 transition-colors duration-200">
                  <Clock className="w-8 h-8 text-yellow-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-800">Pending</p>
                    <p className="text-2xl font-bold text-yellow-900">
                      {campaignLoading ? (
                        <div className="h-8 w-16 bg-yellow-200 rounded animate-pulse"></div>
                      ) : (
                        campaignData?.pendingRequests?.toLocaleString() || '0'
                      )}
                    </p>
                    {campaignData?.pendingRequests && campaignData.pendingRequests > 0 && (
                      <Badge variant="destructive" className="mt-1 text-xs">Action Required</Badge>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-3 p-4 bg-red-50 rounded-lg border border-red-200 hover:bg-red-100 transition-colors duration-200">
                  <AlertCircle className="w-8 h-8 text-red-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800">Rejected</p>
                    <p className="text-2xl font-bold text-red-900">
                      {campaignLoading ? (
                        <div className="h-8 w-16 bg-red-200 rounded animate-pulse"></div>
                      ) : (
                        campaignData?.rejectedRequests?.toLocaleString() || '0'
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="performance" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {reputationLoading ? (
              <>
                <ReputationCardSkeleton />
                <ReputationCardSkeleton />
              </>
            ) : reputationData ? (
              <>
                <BounceRateCard 
                  data={reputationData.reputationData} 
                  currentRate={reputationData.bounceRate}
                  status={reputationData.status}
                />
                <ComplaintRateCard 
                  data={reputationData.reputationData} 
                  currentRate={reputationData.complaintRate}
                  status={reputationData.status}
                />
              </>
            ) : (
              <>
                <ReputationCardSkeleton />
                <ReputationCardSkeleton />
              </>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="activity" className="space-y-6">
          <ActivitySection campaignData={campaignData} campaignLoading={campaignLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
