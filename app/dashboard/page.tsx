"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  Users,
  Mail,
  Target,
  AlertCircle,
  CheckCircle,
  Clock,
} from "lucide-react";
import { useEffect, useState } from "react";
import BounceRateCard from "@/components/BounceRateCard";
import ComplaintRateCard from "@/components/ComplaintRateCard";
import IndividualStatsCard from "@/components/IndividualStatsCard";
import ActivitySection from "@/components/ActivitySection";
import {
  StatsCardSkeleton,
  ReputationCardSkeleton,
  ActivityCardSkeleton,
  QuickActionsCardSkeleton,
  AlertSkeleton,
  TabsSkeleton,
} from "@/components/SkeletonLoaders";
import RefreshButton from "@/components/RefreshButton";

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
  status: "Healthy" | "Warning" | "Account at risk";
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
  const [reputationData, setReputationData] = useState<ReputationData | null>(
    null,
  );

  const fetchAccountData = async () => {
    setAccountLoading(true);
    try {
      const res = await fetch("/api/stats/account");
      if (res.ok) {
        const data = await res.json();
        setAccountData(data);
      }
    } catch (error) {
      console.error("Failed to fetch account stats:", error);
      setAccountData(null);
    } finally {
      setAccountLoading(false);
    }
  };

  const fetchCampaignData = async () => {
    setCampaignLoading(true);
    try {
      const res = await fetch("/api/stats/campaigns");
      if (res.ok) {
        const data = await res.json();
        setCampaignData(data);
      }
    } catch (error) {
      console.error("Failed to fetch campaign stats:", error);
      setCampaignData(null);
    } finally {
      setCampaignLoading(false);
    }
  };

  const fetchEmailData = async () => {
    setEmailLoading(true);
    try {
      const res = await fetch("/api/stats/emails");
      if (res.ok) {
        const data = await res.json();
        setEmailData(data);
      }
    } catch (error) {
      console.error("Failed to fetch email stats:", error);
      setEmailData(null);
    } finally {
      setEmailLoading(false);
    }
  };

  const fetchReputationData = async () => {
    setReputationLoading(true);
    try {
      const res = await fetch("/api/stats/reputation");
      if (res.ok) {
        const data = await res.json();
        setReputationData(data);
      }
    } catch (error) {
      console.error("Failed to fetch reputation stats:", error);
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
      fetchReputationData(),
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

  const isLoading =
    accountLoading || campaignLoading || emailLoading || reputationLoading;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            Dashboard Overview
          </h1>
          <p className="text-muted-foreground mt-2">
            Welcome back! Here's what's happening across your platform today.
          </p>
        </div>
        <RefreshButton onRefresh={handleRefresh} isLoading={refreshing} />
      </div>

      {/* System Status Alert */}
      {reputationLoading ? (
        <AlertSkeleton />
      ) : reputationData ? (
        <Alert
          variant={
            reputationData.status === "Healthy" ||
            reputationData.status === "Warning"
              ? "default"
              : "destructive"
          }
        >
          {reputationData.status === "Healthy" ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertTitle>
            Email Reputation: {reputationData.status}
          </AlertTitle>
          <AlertDescription>
            {reputationData.status === "Healthy"
              ? "Your email reputation is excellent. Continue maintaining good sending practices."
              : reputationData.status === "Warning"
                ? "Some issues detected. Monitor your bounce and complaint rates closely."
                : "Immediate attention required. Your account reputation is at risk."}
          </AlertDescription>
        </Alert>
      ) : null}

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Dashboard</TabsTrigger>
          <TabsTrigger value="performance">Email Reputation</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Stats Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Companies Card */}
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Companies
                    </p>
                    <div className="text-xl font-bold">
                      {accountLoading ? (
                        <Skeleton className="inline-block h-6 w-14" />
                      ) : (
                        accountData?.companyCount?.toLocaleString() || "0"
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {accountLoading ? (
                        <Skeleton className="inline-block h-3 w-10" />
                      ) : (
                        `${accountData?.activeCompanyCount?.toLocaleString() || "0"} active`
                      )}
                    </div>
                  </div>
                  <div className="p-2 bg-muted rounded-full">
                    <Building2 className="w-5 h-5 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Users Card */}
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-muted-foreground">Users</p>
                    <div className="text-xl font-bold">
                      {accountLoading ? (
                        <Skeleton className="inline-block h-6 w-14" />
                      ) : (
                        accountData?.userCount?.toLocaleString() || "0"
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {accountLoading ? (
                        <Skeleton className="inline-block h-3 w-10" />
                      ) : (
                        `${accountData?.activeUserCount?.toLocaleString() || "0"} active`
                      )}
                    </div>
                  </div>
                  <div className="p-2 bg-muted rounded-full">
                    <Users className="w-5 h-5 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Campaigns Card */}
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Campaigns
                    </p>
                    <div className="text-xl font-bold">
                      {campaignLoading ? (
                        <Skeleton className="inline-block h-6 w-14" />
                      ) : (
                        campaignData?.totalCampaigns?.toLocaleString() || "0"
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {campaignLoading ? (
                        <Skeleton className="inline-block h-3 w-10" />
                      ) : (
                        `${campaignData?.activeCampaigns?.toLocaleString() || "0"} active`
                      )}
                    </div>
                  </div>
                  <div className="p-2 bg-muted rounded-full">
                    <Target className="w-5 h-5 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Emails Card */}
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Emails
                    </p>
                    <div className="text-xl font-bold">
                      {emailLoading ? (
                        <Skeleton className="inline-block h-6 w-14" />
                      ) : (
                        emailData?.thisMonthEmails?.toLocaleString() || "0"
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {emailLoading ? (
                        <Skeleton className="inline-block h-3 w-10" />
                      ) : (
                        `This month${emailData && emailData.emailGrowth > 0 ? ` (+${emailData.emailGrowth}%)` : ""}`
                      )}
                    </div>
                  </div>
                  <div className="p-2 bg-muted rounded-full">
                    <Mail className="w-5 h-5 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Requests Status Grid */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Customer Requests Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="flex items-center space-x-3 p-4">
                    <CheckCircle className="w-8 h-8 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        Completed
                      </p>
                      <div className="text-2xl font-bold">
                        {campaignLoading ? (
                          <Skeleton className="h-8 w-16" />
                        ) : (
                          campaignData?.completedRequests?.toLocaleString() || "0"
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="flex items-center space-x-3 p-4">
                    <Clock className="w-8 h-8 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        Pending
                      </p>
                      <div className="text-2xl font-bold">
                        {campaignLoading ? (
                          <Skeleton className="h-8 w-16" />
                        ) : (
                          campaignData?.pendingRequests?.toLocaleString() || "0"
                        )}
                      </div>
                      {campaignData?.pendingRequests &&
                        campaignData.pendingRequests > 0 && (
                          <Badge variant="destructive" className="mt-1 text-xs">
                            Action Required
                          </Badge>
                        )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="flex items-center space-x-3 p-4">
                    <AlertCircle className="w-8 h-8 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        Rejected
                      </p>
                      <div className="text-2xl font-bold">
                        {campaignLoading ? (
                          <Skeleton className="h-8 w-16" />
                        ) : (
                          campaignData?.rejectedRequests?.toLocaleString() || "0"
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
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
          <ActivitySection
            campaignData={campaignData}
            campaignLoading={campaignLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
