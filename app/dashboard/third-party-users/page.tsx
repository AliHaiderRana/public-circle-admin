'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ChevronLeft,
  ChevronRight,
  Mail,
  RefreshCw,
  ScrollText,
  Search,
  UserRound,
} from 'lucide-react';

type ThirdPartyUserRow = {
  id: string;
  referralUserId: string;
  emailAddress: string;
  name: string;
  role: string;
  roleLabel: string;
  status: string;
  signupStep: number;
  signupCompleted: boolean;
  signupCompletedAt?: string | null;
  portalAccess: string;
  country?: string;
  city?: string;
  phoneNumber?: string;
};

const PORTAL_ACCESS_OPTIONS = [
  { value: 'active', label: 'Active (can access)' },
  { value: 'revoked', label: 'Revoked (blocked)' },
];

function normalizePortalAccess(value: string | undefined | null): 'active' | 'revoked' {
  return value === 'active' ? 'active' : 'revoked';
}

export default function ThirdPartyUsersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<ThirdPartyUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [portalFilter, setPortalFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [message, setMessage] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [pendingPortalAction, setPendingPortalAction] = useState<{
    userId: string;
    userName: string;
    nextAccess: 'active' | 'revoked';
  } | null>(null);

  useEffect(() => {
    if (!authLoading && user && !user.isSuperAdmin) {
      router.replace('/dashboard');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchUsers = useCallback(async () => {
    if (!user?.isSuperAdmin) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '25',
      });
      if (search) params.set('search', search);
      if (roleFilter !== 'all') params.set('role', roleFilter);
      if (portalFilter !== 'all') params.set('portalAccess', normalizePortalAccess(portalFilter));
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`/api/third-party-users?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load referral users');

      setUsers(
        (data.users ?? []).map((row: ThirdPartyUserRow) => ({
          ...row,
          portalAccess: normalizePortalAccess(row.portalAccess),
        })),
      );
      setTotalPages(data.pagination?.totalPages ?? 1);
      setTotal(data.pagination?.total ?? 0);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to load referral users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [user?.isSuperAdmin, page, search, roleFilter, portalFilter, statusFilter]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const handlePortalAccessChange = async (userId: string, portalAccess: string) => {
    const normalizedPortalAccess = normalizePortalAccess(portalAccess);
    setUpdatingId(userId);
    setMessage('');
    try {
      const res = await fetch(`/api/third-party-users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portalAccess: normalizedPortalAccess }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to update portal access');
      setUsers((prev) =>
        prev.map((row) =>
          row.id === userId ? { ...row, portalAccess: normalizedPortalAccess } : row,
        ),
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to update portal access');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleConfirmPortalAction = async () => {
    if (!pendingPortalAction) return;
    await handlePortalAccessChange(pendingPortalAction.userId, pendingPortalAction.nextAccess);
    setPendingPortalAction(null);
  };

  if (authLoading || !user?.isSuperAdmin) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Referral app users</h2>
        <p className="text-muted-foreground mt-1 max-w-3xl">
          Third-party users synced from the referral app. Manage portal access and open audit
          trails for sales and marketing partners.
        </p>
      </div>

      {message ? (
        <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">{message}</div>
      ) : null}

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search name, email, phone…"
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={(value) => { setRoleFilter(value); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="SALES_PERSON">Sales person</SelectItem>
                <SelectItem value="MARKETING_AFFILIATE">Marketing affiliate</SelectItem>
                <SelectItem value="ADMIN">Referral admin</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={portalFilter}
              onValueChange={(value) => {
                setPortalFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Portal access" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All portal access</SelectItem>
                {PORTAL_ACCESS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INVITED">Invited</SelectItem>
                <SelectItem value="DISABLED">Disabled</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => void fetchUsers()} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>

          <div className="text-sm text-muted-foreground">
            {total.toLocaleString()} user{total === 1 ? '' : 's'}
          </div>
          <div className="text-xs text-muted-foreground">
            Portal access: <span className="font-medium text-foreground">Active</span> means the
            user can access the admin portal, <span className="font-medium text-foreground">Revoked</span>{' '}
            blocks access.
          </div>

          <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Portal access</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-10 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-40 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <UserRound className="h-8 w-8 opacity-40" />
                      <p>No referral users found. Run the seed script if this is a new environment.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <UserRound className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{row.name}</div>
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Mail className="h-3.5 w-3.5" />
                            <span className="truncate">{row.emailAddress}</span>
                          </div>
                          {row.city || row.country ? (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {[row.city, row.country].filter(Boolean).join(', ')}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{row.roleLabel}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm capitalize text-muted-foreground">{row.status.toLowerCase()}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground capitalize">
                        {normalizePortalAccess(row.portalAccess)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={updatingId === row.id || normalizePortalAccess(row.portalAccess) === 'active'}
                          onClick={() =>
                            setPendingPortalAction({
                              userId: row.id,
                              userName: row.name,
                              nextAccess: 'active',
                            })
                          }
                        >
                          Activate
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={updatingId === row.id || normalizePortalAccess(row.portalAccess) === 'revoked'}
                          onClick={() =>
                            setPendingPortalAction({
                              userId: row.id,
                              userName: row.name,
                              nextAccess: 'revoked',
                            })
                          }
                        >
                          Revoke
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1.5" asChild>
                          <Link
                            href={`/dashboard/admins/activity?${new URLSearchParams({
                              adminEmail: row.emailAddress,
                              adminName: row.name,
                              userType: 'support_partner',
                              from: 'referral_users',
                            }).toString()}`}
                          >
                            <ScrollText className="h-3.5 w-3.5" />
                            Activity
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={Boolean(pendingPortalAction)}
        onOpenChange={(open) => {
          if (!open) setPendingPortalAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingPortalAction?.nextAccess === 'active'
                ? 'Activate portal access?'
                : 'Revoke portal access?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingPortalAction?.nextAccess === 'active'
                ? `This will allow ${pendingPortalAction?.userName || 'this referral user'} to sign in to the admin portal.`
                : `This will immediately block ${pendingPortalAction?.userName || 'this referral user'} from signing in to the admin portal.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(updatingId)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmPortalAction();
              }}
              disabled={Boolean(updatingId)}
            >
              {updatingId ? 'Saving...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
