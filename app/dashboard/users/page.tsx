"use client";

import { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { startImpersonation } from "@/lib/impersonate-client";

export default function UsersPage() {
  const { token: adminToken } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [companies, setCompanies] = useState<Array<{ _id: string; name: string; logo?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [impersonateUserId, setImpersonateUserId] = useState<string | null>(null);
  const [tourModalUser, setTourModalUser] = useState<any>(null);
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

  const selectedCompanyLabel = useMemo(() => {
    if (companyFilter === 'all') return 'All companies';
    const selected = companies.find((c) => c._id === companyFilter);
    return selected?.name || 'All companies';
  }, [companies, companyFilter]);

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleLoginAsUser = async (user: any) => {
    const companyId = user?.company?._id;
    if (!companyId) {
      toast.error('User does not belong to a company.');
      return;
    }

    setImpersonateUserId(user._id);
    try {
      const redirectUrl = await startImpersonation({
        userId: user._id,
        companyId,
        adminToken,
      });
      window.open(redirectUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to login as user');
    } finally {
      setImpersonateUserId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">System Users</h2>
          <p className="text-muted-foreground">
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
              <Popover open={companyDropdownOpen} onOpenChange={setCompanyDropdownOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={companyDropdownOpen}
                    className="w-64 justify-between"
                  >
                    <span className="truncate">{selectedCompanyLabel}</span>
                    <ChevronsUpDown className="h-4 w-4 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0">
                  <Command>
                    <CommandInput placeholder="Search company..." />
                    <CommandList>
                      <CommandEmpty>No company found</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="All companies"
                          onSelect={() => handleCompanyFilter("all")}
                        >
                          <Building2 className="size-3.5 text-muted-foreground" />
                          <span className="truncate">All companies</span>
                        </CommandItem>
                        {companies.map((company) => (
                          <CommandItem
                            key={company._id}
                            value={`${company.name} ${company._id}`}
                            onSelect={() => handleCompanyFilter(company._id)}
                          >
                            {company.logo ? (
                              <img
                                src={company.logo}
                                alt={company.name}
                                className="h-5 w-5 rounded object-cover border"
                              />
                            ) : (
                              <div className="h-5 w-5 rounded bg-muted border flex items-center justify-center">
                                <Building2 size={12} className="text-muted-foreground" />
                              </div>
                            )}
                            <span className="truncate">{company.name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
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
                    className="text-center h-48 text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <User size={40} className="text-muted-foreground" />
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
                        <Avatar className="size-8">
                          {user.profilePicture && (
                            <AvatarImage
                              src={user.profilePicture}
                              alt=""
                              className="object-cover"
                            />
                          )}
                          <AvatarFallback>
                            <User size={14} />
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-sm">
                            {user.firstName} {user.lastName}
                          </div>
                          {user.isEmailVerified && (
                            <div className="flex items-center text-[10px] text-foreground gap-0.5">
                              <ShieldCheck size={10} /> Verified
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1">
                        <Mail size={12} className="text-muted-foreground" />
                        {user.emailAddress}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1">
                        <Building2 size={12} className="text-muted-foreground" />
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
                        className="text-[10px]"
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
                            className={`h-3.5 w-3.5 shrink-0 ${user.tourSteps?.isCompleted ? 'text-green-600' : 'text-muted'}`}
                          />
                          <span className={`text-xs font-medium ${user.tourSteps?.isCompleted ? 'text-green-600' : 'text-muted-foreground'}`}>
                            {user.tourSteps ? user.tourSteps.completed : 0}/{user.tourSteps ? user.tourSteps.total : 9}
                          </span>
                        </div>
                        {user.tourSteps && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
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
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <div className="text-sm text-muted-foreground">
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
              <MapPin className="h-4 w-4 text-muted-foreground" />
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
                <span className="text-sm text-muted-foreground">
                  {tourModalUser.tourSteps.completed} of {tourModalUser.tourSteps.total} steps completed
                </span>
                {tourModalUser.tourSteps.isCompleted && (
                  <Badge>Tour Complete</Badge>
                )}
                {tourModalUser.tourSteps.isSkipped && (
                  <Badge variant="secondary">Skipped</Badge>
                )}
              </div>

              {/* Step list */}
              <div className="space-y-2">
                {(tourModalUser.tourSteps.steps || []).map((step: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 py-1">
                    {step.isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    )}
                    <div>
                      <p className={`text-sm font-medium leading-tight ${step.isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {step.title || `Step ${i + 1}`}
                      </p>
                      {step.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
