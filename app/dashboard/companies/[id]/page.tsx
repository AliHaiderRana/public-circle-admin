'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Building2,
  Users,
  Mail,
  Send,
  FileText,
  Pause,
  Archive,
  ArchiveRestore,
  UserPlus,
  Activity,
  TrendingUp,
  Ban,
  CheckCircle,
  Loader2,
  Play,
  LogIn,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { startImpersonation } from '@/lib/impersonate-client';
import { RemoveCompanyDialog, type RemoveCompanyMode } from '@/components/RemoveCompanyDialog';
import { RestoreCompanyDialog, type ArchivedCompanyRow } from '@/components/RestoreCompanyDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface CompanyDetails {
  company: {
    id: string;
    name: string;
    email: string;
    logo: string;
    status: string;
    createdAt: string;
  };
  users: {
    primary: Array<{
      id: string;
      emailAddress: string;
      firstName: string;
      lastName: string;
      phoneNumber: string;
      profilePicture: string;
      createdAt: string;
      status: string;
    }>;
    secondary: Array<{
      id: string;
      emailAddress: string;
      firstName: string;
      lastName: string;
      phoneNumber: string;
      profilePicture: string;
      createdAt: string;
      status: string;
    }>;
    totalUsers: number;
  };
  contacts: {
    total: number;
    active: number;
    deleted: number;
    inactive: number;
  };
  campaigns: {
    total: number;
    active: number;
    draft: number;
    paused: number;
    archived: number;
  };
}

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { token: adminToken, user: authUser } = useAuth();
  const isPartnerView = Boolean(authUser?.isPartner);
  const isSuperAdmin = Boolean(authUser?.isSuperAdmin);
  const [companyDetails, setCompanyDetails] = useState<CompanyDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [impersonateUserId, setImpersonateUserId] = useState<string | null>(null);
  const [removeMode, setRemoveMode] = useState<RemoveCompanyMode | null>(null);
  const [archivedRecord, setArchivedRecord] = useState<ArchivedCompanyRow | null>(null);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchCompanyDetails();
    }
  }, [params.id]);

  useEffect(() => {
    if (companyDetails?.company.status !== 'ARCHIVED' || !isSuperAdmin) {
      setArchivedRecord(null);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/companies/${companyDetails.company.id}/archived-record`);
        const data = await res.json();
        setArchivedRecord(res.ok ? data.data : null);
      } catch {
        setArchivedRecord(null);
      }
    })();
  }, [companyDetails?.company.status, companyDetails?.company.id, isSuperAdmin]);

  const fetchCompanyDetails = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/company-details/${params.id}`);
      if (!response.ok) throw new Error('Failed to fetch company details');
      
      const data = await response.json();
      setCompanyDetails(data.data);
    } catch (error) {
      console.error('Error fetching company details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBlockCompany = async () => {
    if (!companyDetails) return;
    
    setActionLoading(true);
    try {
      const response = await fetch(`/api/companies/${companyDetails.company.id}/block`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to block company');
      }
      
      // Refresh company details
      await fetchCompanyDetails();
    } catch (error) {
      console.error('Error blocking company:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to block company');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnblockCompany = async () => {
    if (!companyDetails) return;
    
    setActionLoading(true);
    try {
      const response = await fetch(`/api/companies/${companyDetails.company.id}/unblock`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to unblock company');
      }
      
      // Refresh company details
      await fetchCompanyDetails();
    } catch (error) {
      console.error('Error unblocking company:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to unblock company');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLoginAsUser = async (userId: string) => {
    if (!companyDetails) return;
    setImpersonateUserId(userId);
    try {
      const redirectUrl = await startImpersonation({
        userId,
        companyId: companyDetails.company.id,
        adminToken,
      });
      window.open(redirectUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Impersonation error:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to open Public Circle as this user'
      );
    } finally {
      setImpersonateUserId(null);
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

  if (!companyDetails) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold text-foreground">Company not found</h2>
          <p className="text-muted-foreground mt-2">The company you're looking for doesn't exist.</p>
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
            {companyDetails.company.logo && companyDetails.company.logo.trim() !== '' ? (
              <div className="relative">
                <img
                  src={companyDetails.company.logo}
                  alt={companyDetails.company.name}
                  className="h-12 w-12 rounded-lg object-cover border border-border"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <div className="hidden h-12 w-12 rounded-lg bg-muted flex items-center justify-center border border-border">
                  <Building2 className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
            ) : (
              <Avatar className="h-12 w-12">
                <AvatarFallback>
                  {companyDetails.company.name ? companyDetails.company.name.charAt(0).toUpperCase() : 'C'}
                </AvatarFallback>
              </Avatar>
            )}
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {companyDetails.company.name}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant={
                    companyDetails.company.status === 'ACTIVE'
                      ? 'default'
                      : companyDetails.company.status === 'BLOCKED'
                      ? 'destructive'
                      : companyDetails.company.status === 'ARCHIVED'
                      ? 'outline'
                      : 'secondary'
                  }
                >
                  {companyDetails.company.status}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Created {new Date(companyDetails.company.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {companyDetails.company.status === 'ARCHIVED' ? (
            isSuperAdmin && (
              <Button
                className="flex items-center gap-2"
                onClick={() => setRestoreDialogOpen(true)}
                disabled={!archivedRecord}
              >
                <ArchiveRestore className="h-4 w-4" />
                Restore Company
              </Button>
            )
          ) : (
            <>
          {isSuperAdmin && (
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={() => setRemoveMode('archive')}
            >
              <Archive className="h-4 w-4" />
              Archive Company
            </Button>
          )}
          {isSuperAdmin && (
            <Button
              variant="destructive"
              className="flex items-center gap-2"
              onClick={() => setRemoveMode('delete')}
            >
              <Trash2 className="h-4 w-4" />
              Delete Company
            </Button>
          )}
          {!isPartnerView && companyDetails.company.status === 'ACTIVE' ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  className="flex items-center gap-2"
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Ban className="h-4 w-4" />
                  )}
                  Block Company
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Block Company</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to block <strong>{companyDetails.company.name}</strong>? 
                    This action will:
                  </AlertDialogDescription>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-muted-foreground">
                    <li>Suspend all users belonging to this company</li>
                    <li>Pause all active campaigns</li>
                    <li>Prevent users from logging in</li>
                  </ul>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleBlockCompany}
                    className={buttonVariants({ variant: "destructive" })}
                  >
                    Block Company
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : !isPartnerView && companyDetails.company.status === 'BLOCKED' ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="default" 
                  className="flex items-center gap-2"
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  Unblock Company
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Unblock Company</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to unblock <strong>{companyDetails.company.name}</strong>? 
                    This action will:
                  </AlertDialogDescription>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-muted-foreground">
                    <li>Restore all blocked users to active status</li>
                    <li>Allow users to log in again</li>
                    <li>Campaigns will remain paused (you can activate them manually)</li>
                  </ul>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleUnblockCompany}
                  >
                    Unblock Company
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
            </>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Total Users
                </p>
                <p className="text-3xl font-bold text-foreground mt-2">
                  {companyDetails.users.totalUsers}
                </p>
                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span className="text-xs text-muted-foreground font-medium">
                      {companyDetails.users.primary.length} Primary
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span className="text-xs text-muted-foreground font-medium">
                      {companyDetails.users.secondary.length} Secondary
                    </span>
                  </div>
                </div>
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
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  Total Contacts
                </p>
                <p className="text-3xl font-bold text-foreground mt-2">
                  {companyDetails.contacts.total.toLocaleString()}
                </p>
                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span className="text-xs text-muted-foreground font-medium">
                      {companyDetails.contacts.active} Active
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span className="text-xs text-muted-foreground font-medium">
                      {companyDetails.contacts.deleted} Deleted
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span className="text-xs text-muted-foreground font-medium">
                      {companyDetails.contacts.inactive} Inactive
                    </span>
                  </div>
                </div>
              </div>
              <div className="h-14 w-14 bg-muted rounded-lg flex items-center justify-center">
                <Mail className="h-7 w-7 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <Send className="h-4 w-4 text-muted-foreground" />
                  Total Campaigns
                </p>
                <p className="text-3xl font-bold text-foreground mt-2">
                  {companyDetails.campaigns.total}
                </p>
                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span className="text-xs text-muted-foreground font-medium">
                      {companyDetails.campaigns.active} Active
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span className="text-xs text-muted-foreground font-medium">
                      {companyDetails.campaigns.draft} Draft
                    </span>
                  </div>
                </div>
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
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  Campaign Status
                </p>
                <div className="space-y-2 mt-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <span className="text-xs text-muted-foreground">Active</span>
                    </div>
                    <span className="text-xs font-semibold text-foreground">{companyDetails.campaigns.active}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <span className="text-xs text-muted-foreground">Paused</span>
                    </div>
                    <span className="text-xs font-semibold text-foreground">{companyDetails.campaigns.paused}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <span className="text-xs text-muted-foreground">Archived</span>
                    </div>
                    <span className="text-xs font-semibold text-foreground">{companyDetails.campaigns.archived}</span>
                  </div>
                </div>
              </div>
              <div className="h-14 w-14 bg-muted rounded-lg flex items-center justify-center">
                <Activity className="h-7 w-7 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users and Campaigns Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Users Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Users
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Primary Users */}
            <div>
              <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                Primary Users
              </h4>
              {companyDetails.users.primary.length > 0 ? (
                <div className="space-y-3">
                  {companyDetails.users.primary.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-4 bg-muted rounded-xl">
                      <div className="flex items-center gap-3">
                        {user.profilePicture ? (
                          <img
                            src={user.profilePicture}
                            alt={`${user.firstName} ${user.lastName}`}
                            className="h-10 w-10 rounded-full object-cover border-2 border-white shadow-sm"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              target.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : (
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>
                              {user.firstName ? user.firstName.charAt(0).toUpperCase() : ''}{user.lastName ? user.lastName.charAt(0).toUpperCase() : ''}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div className="hidden h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                          <UserPlus className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">
                            {user.firstName || ''} {user.lastName || ''}
                          </p>
                          <p className="text-sm text-muted-foreground">{user.emailAddress || ''}</p>
                          {user.phoneNumber && (
                            <p className="text-xs text-muted-foreground mt-1">{user.phoneNumber}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {user.status !== 'ACTIVE' && (
                          <Badge variant={user.status === 'BLOCKED' ? 'destructive' : 'secondary'}>
                            {user.status}
                          </Badge>
                        )}
                        <Badge>Primary</Badge>
                        {companyDetails.company.status === 'ACTIVE' &&
                          user.status === 'ACTIVE' && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1 shrink-0"
                              disabled={impersonateUserId !== null}
                              onClick={() => handleLoginAsUser(user.id)}
                            >
                              {impersonateUserId === user.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <LogIn className="h-4 w-4" />
                              )}
                              Login as this user
                            </Button>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-muted rounded-xl">
                  <UserPlus className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">No primary users found</p>
                </div>
              )}
            </div>

            {/* Secondary Users */}
            <div>
              <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                Secondary Users
              </h4>
              {companyDetails.users.secondary.length > 0 ? (
                <div className="space-y-3">
                  {companyDetails.users.secondary.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-4 bg-muted rounded-xl">
                      <div className="flex items-center gap-3">
                        {user.profilePicture ? (
                          <img
                            src={user.profilePicture}
                            alt={`${user.firstName} ${user.lastName}`}
                            className="h-10 w-10 rounded-full object-cover border-2 border-white shadow-sm"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              target.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : (
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>
                              {user.firstName ? user.firstName.charAt(0).toUpperCase() : ''}{user.lastName ? user.lastName.charAt(0).toUpperCase() : ''}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div className="hidden h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                          <UserPlus className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">
                            {user.firstName || ''} {user.lastName || ''}
                          </p>
                          <p className="text-sm text-muted-foreground">{user.emailAddress || ''}</p>
                          {user.phoneNumber && (
                            <p className="text-xs text-muted-foreground mt-1">{user.phoneNumber}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {user.status !== 'ACTIVE' && (
                          <Badge variant={user.status === 'BLOCKED' ? 'destructive' : 'secondary'}>
                            {user.status}
                          </Badge>
                        )}
                        <Badge variant="secondary">Secondary</Badge>
                        {companyDetails.company.status === 'ACTIVE' &&
                          user.status === 'ACTIVE' && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1 shrink-0"
                              disabled={impersonateUserId !== null}
                              onClick={() => handleLoginAsUser(user.id)}
                            >
                              {impersonateUserId === user.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <LogIn className="h-4 w-4" />
                              )}
                              Login as this user
                            </Button>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-muted rounded-xl">
                  <UserPlus className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">No secondary users found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Campaigns Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Campaigns Overview
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => router.push(`/dashboard/campaign-runs?company=${companyDetails.company.id}`)}
                  className="flex items-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  View Campaign Runs
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push(`/dashboard/campaigns?company=${companyDetails.company.id}`)}
                  className="flex items-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  View Campaigns
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-foreground">
                    {companyDetails.campaigns.active}
                  </div>
                  <div className="text-sm text-muted-foreground">Active Campaigns</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-foreground">
                    {companyDetails.campaigns.draft}
                  </div>
                  <div className="text-sm text-muted-foreground">Draft Campaigns</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-foreground">
                    {companyDetails.campaigns.paused}
                  </div>
                  <div className="text-sm text-muted-foreground">Paused Campaigns</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-foreground">
                    {companyDetails.campaigns.archived}
                  </div>
                  <div className="text-sm text-muted-foreground">Archived Campaigns</div>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Campaigns</span>
                  <span className="text-lg font-semibold text-foreground">
                    {companyDetails.campaigns.total}
                  </span>
                </div>
                <div className="mt-2">
                  <Progress
                    value={companyDetails.campaigns.total > 0 ? (companyDetails.campaigns.active / companyDetails.campaigns.total) * 100 : 0}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {companyDetails.campaigns.total > 0 ? Math.round((companyDetails.campaigns.active / companyDetails.campaigns.total) * 100) : 0}% of campaigns are active
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {isSuperAdmin && removeMode && (
        <RemoveCompanyDialog
          open={Boolean(removeMode)}
          onOpenChange={(next) => !next && setRemoveMode(null)}
          mode={removeMode}
          companyId={companyDetails.company.id}
          companyName={companyDetails.company.name}
          onRemoved={() => {
            toast.success(
              removeMode === 'archive'
                ? `"${companyDetails.company.name}" archived`
                : `"${companyDetails.company.name}" permanently deleted`
            );
            router.push('/dashboard/companies');
          }}
        />
      )}

      {isSuperAdmin && archivedRecord && (
        <RestoreCompanyDialog
          open={restoreDialogOpen}
          onOpenChange={setRestoreDialogOpen}
          archived={archivedRecord}
          onRestored={() => {
            toast.success(`"${companyDetails.company.name}" restored`);
            void fetchCompanyDetails();
          }}
        />
      )}
    </div>
  );
}
