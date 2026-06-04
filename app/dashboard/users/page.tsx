"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  User,
  Mail,
  ShieldCheck,
  Building2,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  LogIn,
  Loader2,
  ChevronsUpDown,
  CheckCircle2,
  Circle,
  MapPin,
  ShieldAlert,
} from "lucide-react";
import AdminImpersonationActivitySection from "@/components/AdminImpersonationActivitySection";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [companies, setCompanies] = useState<Array<{ _id: string; name: string; logo?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [companySearchTerm, setCompanySearchTerm] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [impersonateUserId, setImpersonateUserId] = useState<string | null>(null);
  const [tourModalUser, setTourModalUser] = useState<any>(null);
  const [activityModalUser, setActivityModalUser] = useState<any>(null);
  const companyDropdownRef = useRef<HTMLDivElement | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  });

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    fetchUsers();
  }, [pagination.page, pagination.limit, searchTerm, sortOrder, companyFilter]);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const res = await fetch('/api/companies?page=1&limit=500&sort=asc');
      const data = await res.json();
      if (Array.isArray(data?.companies)) {
        setCompanies(data.companies.map((company: any) => ({
          _id: String(company._id),
          name: company.name || 'Unnamed Company',
          logo: company.logo || '',
        })));
      } else {
        setCompanies([]);
      }
    } catch {
      setCompanies([]);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sort: sortOrder,
        ...(searchTerm && { search: searchTerm }),
        ...(companyFilter !== "all" && { companyId: companyFilter }),
      });

      const res = await fetch(`/api/users?${params}`);
      const data = await res.json();

      if (data.users) {
        setUsers(data.users);
        setPagination(data.pagination);
      } else {
        setUsers([]);
      }
    } catch (err) {
      console.error("Failed to load users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  const handleSearch = (value: string) => {
    setSearchInput(value);
  };

  const handleCompanyFilter = (value: string) => {
    setCompanyFilter(value);
    setCompanyDropdownOpen(false);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const filteredCompanies = useMemo(() => {
    const term = companySearchTerm.trim().toLowerCase();
    if (!term) return companies;
    return companies.filter((company) => company.name.toLowerCase().includes(term));
  }, [companies, companySearchTerm]);

  const selectedCompanyLabel = useMemo(() => {
    if (companyFilter === 'all') return 'All companies';
    const selected = companies.find((c) => c._id === companyFilter);
    return selected?.name || 'All companies';
  }, [companies, companyFilter]);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!companyDropdownRef.current) return;
      if (!companyDropdownRef.current.contains(event.target as Node)) {
        setCompanyDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleLoginAsUser = async (user: any) => {
    const companyId = user?.company?._id;
    if (!companyId) {
      alert('User does not belong to a company.');
      return;
    }

    setImpersonateUserId(user._id);
    try {
      const response = await fetch('/api/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user._id,
          companyId,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof data?.error === 'string' ? data.error : 'Failed to start impersonation'
        );
      }
      if (typeof data.redirectUrl !== 'string' || !data.redirectUrl) {
        throw new Error('Invalid redirect URL from server');
      }
      window.open(data.redirectUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to login as user');
    } finally {
      setImpersonateUserId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">System Users</h2>
          <p className="text-neutral-500">
            Manage administrative and platform users across all companies.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle>User Directory</CardTitle>
              <CardDescription>
                {pagination.total > 0
                  ? `Showing ${users.length} of ${pagination.total} users`
                  : "Search by name, email, or company."}
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative w-64" ref={companyDropdownRef}>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => setCompanyDropdownOpen((prev) => !prev)}
                >
                  <span className="truncate">{selectedCompanyLabel}</span>
                  <ChevronsUpDown className="h-4 w-4 opacity-60" />
                </Button>
                {companyDropdownOpen && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow-lg">
                    <div className="p-2 border-b">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-500 h-4 w-4" />
                        <Input
                          placeholder="Search company..."
                          className="pl-8 h-8"
                          value={companySearchTerm}
                          onChange={(e) => setCompanySearchTerm(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto p-1">
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-neutral-100"
                        onClick={() => handleCompanyFilter("all")}
                      >
                        <Building2 size={14} className="text-neutral-500" />
                        <span className="truncate">All companies</span>
                      </button>
                      {filteredCompanies.length === 0 ? (
                        <div className="px-2 py-2 text-xs text-neutral-500">No company found</div>
                      ) : (
                        filteredCompanies.map((company) => (
                          <button
                            key={company._id}
                            type="button"
                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-neutral-100"
                            onClick={() => handleCompanyFilter(company._id)}
                          >
                            {company.logo ? (
                              <img
                                src={company.logo}
                                alt={company.name}
                                className="h-5 w-5 rounded object-cover border"
                              />
                            ) : (
                              <div className="h-5 w-5 rounded bg-neutral-100 border flex items-center justify-center">
                                <Building2 size={12} className="text-neutral-500" />
                              </div>
                            )}
                            <span className="truncate">{company.name}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleSortOrder}
                className="flex items-center gap-2"
              >
                {sortOrder === "desc" ? (
                  <>
                    <ArrowDown size={14} />
                    <span>Newest First</span>
                  </>
                ) : (
                  <>
                    <ArrowUp size={14} />
                    <span>Oldest First</span>
                  </>
                )}
              </Button>
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 h-4 w-4" />
                <Input
                  placeholder="Search users..."
                  className="pl-10"
                  value={searchInput}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">User</TableHead>
                <TableHead>Email Address</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tour Steps</TableHead>
                <TableHead className="pl-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="pl-6">
                      <Skeleton className="h-4 w-[150px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-[180px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-[120px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-[60px] rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-[80px] rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-[60px] rounded-full" />
                    </TableCell>
                    <TableCell className="pl-6">
                      <Skeleton className="h-8 w-16" />
                    </TableCell>
                  </TableRow>
                ))
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center h-48 text-neutral-500"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <User size={40} className="text-neutral-300" />
                      <p>No users found matching your search.</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSearchInput("");
                          setSearchTerm("");
                        }}
                      >
                        Clear search
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user._id}>
                    <TableCell className="pl-6 font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary overflow-hidden">
                          {user.profilePicture ? (
                            <img
                              src={user.profilePicture}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User size={14} />
                          )}
                        </div>
                        <div>
                          <div className="text-sm">
                            {user.firstName} {user.lastName}
                          </div>
                          {user.isEmailVerified && (
                            <div className="flex items-center text-[10px] text-neutral-900 gap-0.5">
                              <ShieldCheck size={10} /> Verified
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1">
                        <Mail size={12} className="text-neutral-400" />
                        {user.emailAddress}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1">
                        <Building2 size={12} className="text-neutral-400" />
                        {user.company?.name || "No Company"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="capitalize text-[10px]"
                      >
                        {user.role?.name === "Admin"
                          ? "Super Admin"
                          : user.role?.name || "Admin"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`text-[10px] ${user.status === "ACTIVE" ? "bg-neutral-900 text-white" : ""}`}
                        variant={
                          user.status === "ACTIVE" ? "default" : "destructive"
                        }
                      >
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <CheckCircle2
                            className={`h-3.5 w-3.5 shrink-0 ${user.tourSteps?.isCompleted ? 'text-green-600' : 'text-neutral-200'}`}
                          />
                          <span className={`text-xs font-medium ${user.tourSteps?.isCompleted ? 'text-green-600' : 'text-neutral-600'}`}>
                            {user.tourSteps ? user.tourSteps.completed : 0}/{user.tourSteps ? user.tourSteps.total : 9}
                          </span>
                        </div>
                        {user.tourSteps && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-neutral-500 hover:text-neutral-900"
                            onClick={() => setTourModalUser(user)}
                          >
                            View
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="pl-6">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          disabled={impersonateUserId !== null || !user.company?._id}
                          onClick={() => handleLoginAsUser(user)}
                        >
                          {impersonateUserId === user._id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <LogIn className="h-4 w-4" />
                          )}
                          Login as this user
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-neutral-600"
                          onClick={() => setActivityModalUser(user)}
                        >
                          <ShieldAlert className="h-4 w-4" />
                          Session log
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <div className="text-sm text-neutral-500">
                Page {pagination.page} of {pagination.pages} ({pagination.total}{" "}
                total users)
              </div>
              <div className="flex items-center gap-2">
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

      {/* Tour Steps Modal */}
      <Dialog open={!!tourModalUser} onOpenChange={(open) => !open && setTourModalUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-neutral-500" />
              Tour Steps —{" "}
              {tourModalUser?.firstName
                ? `${tourModalUser.firstName} ${tourModalUser.lastName || ''}`.trim()
                : tourModalUser?.emailAddress}
            </DialogTitle>
          </DialogHeader>

          {tourModalUser?.tourSteps && (
            <div className="space-y-1 pt-2">
              {/* Summary */}
              <div className="flex items-center justify-between pb-3 border-b mb-3">
                <span className="text-sm text-neutral-500">
                  {tourModalUser.tourSteps.completed} of {tourModalUser.tourSteps.total} steps completed
                </span>
                {tourModalUser.tourSteps.isCompleted && (
                  <span className="text-xs font-medium text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                    Tour Complete
                  </span>
                )}
                {tourModalUser.tourSteps.isSkipped && (
                  <span className="text-xs font-medium text-neutral-500 bg-neutral-100 border px-2 py-0.5 rounded-full">
                    Skipped
                  </span>
                )}
              </div>

              {/* Step list */}
              <div className="space-y-2">
                {(tourModalUser.tourSteps.steps || []).map((step: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 py-1">
                    {step.isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-neutral-300 mt-0.5 shrink-0" />
                    )}
                    <div>
                      <p className={`text-sm font-medium leading-tight ${step.isCompleted ? 'text-neutral-900' : 'text-neutral-400'}`}>
                        {step.title || `Step ${i + 1}`}
                      </p>
                      {step.description && (
                        <p className="text-xs text-neutral-400 mt-0.5">{step.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!activityModalUser}
        onOpenChange={(open) => !open && setActivityModalUser(null)}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              Login as user activity — {activityModalUser?.emailAddress}
            </DialogTitle>
          </DialogHeader>
          {activityModalUser?._id ? (
            <AdminImpersonationActivitySection
              userId={activityModalUser._id}
              compact
              defaultLimit={10}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
