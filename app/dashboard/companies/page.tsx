"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Building2,
  Users as UsersIcon,
  Globe,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Filter,
  ArrowUp,
  ArrowDown,
  Send,
  Mail,
} from "lucide-react";

export default function CompaniesPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [companySizeFilter, setCompanySizeFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  });
  const [filterOptions, setFilterOptions] = useState({
    countries: [] as string[],
    sizes: [] as string[],
    cities: [] as string[],
  });

  useEffect(() => {
    fetchCompanies();
  }, [
    pagination.page,
    pagination.limit,
    searchTerm,
    companySizeFilter,
    countryFilter,
    cityFilter,
    statusFilter,
    sortOrder,
    sortBy,
  ]);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sort: sortOrder,
        sortBy: sortBy,
        ...(searchTerm && { search: searchTerm }),
        ...(companySizeFilter && { companySize: companySizeFilter }),
        ...(countryFilter && { country: countryFilter }),
        ...(cityFilter && { city: cityFilter }),
        ...(statusFilter && { status: statusFilter }),
      });

      const res = await fetch(`/api/companies?${params}`);
      const data = await res.json();

      if (data.companies) {
        setCompanies(data.companies);
        setPagination(data.pagination);
        if (data.filters) {
          setFilterOptions(data.filters);
        }
      } else {
        setCompanies([]);
      }
    } catch (err) {
      console.error("Failed to load companies");
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    setSearchTerm("");
    setCompanySizeFilter("");
    setCountryFilter("");
    setCityFilter("");
    setStatusFilter("");
    setSortOrder("desc");
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Companies</h2>
          <p className="text-neutral-500">
            Manage all registered organizations and their settings.
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm text-neutral-500 bg-white dark:bg-neutral-800 p-2 rounded-lg border">
          <div className="flex items-center gap-1 px-2 border-r">
            <Building2 size={16} />
            <span className="font-bold text-neutral-900">
              {pagination.total}
            </span>{" "}
            Total
          </div>
          <div className="flex items-center gap-1 px-2">
            <Globe size={16} />
            <span className="font-bold text-neutral-900">
              {filterOptions.countries.length}
            </span>{" "}
            Countries
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle>Organization List</CardTitle>
              <CardDescription>
                {pagination.total > 0
                  ? `Showing ${companies.length} of ${pagination.total} companies`
                  : "Search and filter companies by name or location."}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 h-4 w-4" />
                <Input
                  placeholder="Search companies..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-neutral-500" />
              <span className="text-sm font-medium">Filters:</span>
            </div>

            <Select
              value={companySizeFilter || "all"}
              onValueChange={(value) => {
                setCompanySizeFilter(value === "all" ? "" : value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Company Size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sizes</SelectItem>
                {filterOptions.sizes.map((size) => (
                  <SelectItem key={size} value={size}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={countryFilter || "all"}
              onValueChange={(value) => {
                setCountryFilter(value === "all" ? "" : value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                {filterOptions.countries.map((country) => (
                  <SelectItem key={country} value={country}>
                    {country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={cityFilter || "all"}
              onValueChange={(value) => {
                setCityFilter(value === "all" ? "" : value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="City" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                {filterOptions.cities.map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={statusFilter || "all"}
              onValueChange={(value) => {
                setStatusFilter(value === "all" ? "" : value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
                <SelectItem value="BLOCKED">Blocked</SelectItem>
                <SelectItem value="DELETED">Deleted</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Company Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('campaignCount')}
                    className="flex items-center gap-1 -ml-2 h-auto p-1 font-medium hover:bg-transparent"
                  >
                    Campaigns
                    {sortBy === 'campaignCount' && (
                      sortOrder === "desc" ? (
                        <ArrowDown size={14} className="text-primary" />
                      ) : (
                        <ArrowUp size={14} className="text-primary" />
                      )
                    )}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('contactCount')}
                    className="flex items-center gap-1 -ml-2 h-auto p-1 font-medium hover:bg-transparent"
                  >
                    Contacts
                    {sortBy === 'contactCount' && (
                      sortOrder === "desc" ? (
                        <ArrowDown size={14} className="text-primary" />
                      ) : (
                        <ArrowUp size={14} className="text-primary" />
                      )
                    )}
                  </Button>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('createdAt')}
                    className="flex items-center gap-1 -ml-2 h-auto p-1 font-medium hover:bg-transparent"
                  >
                    Registered
                    {sortBy === 'createdAt' && (
                      sortOrder === "desc" ? (
                        <ArrowDown size={14} className="text-primary" />
                      ) : (
                        <ArrowUp size={14} className="text-primary" />
                      )
                    )}
                  </Button>
                </TableHead>
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
                      <Skeleton className="h-4 w-[120px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-[60px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-[80px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-[80px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-[80px] rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-[100px]" />
                    </TableCell>
                    <TableCell className="pl-6">
                      <Skeleton className="h-8 w-16" />
                    </TableCell>
                  </TableRow>
                ))
              ) : companies.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center h-48 text-neutral-500"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Building2 size={40} className="text-neutral-300" />
                      <p>No companies found matching your search.</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearFilters}
                      >
                        Clear filters
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                companies.map((company) => (
                  <TableRow key={company._id}>
                    <TableCell className="pl-6 font-medium">
                      <div className="flex items-center gap-2">
                        {company.logo ? (
                          <img
                            src={company.logo}
                            alt=""
                            className="w-6 h-6 rounded-sm object-contain"
                          />
                        ) : (
                          <div className="w-6 h-6 bg-neutral-100 flex items-center justify-center rounded-sm">
                            <Building2 size={12} className="text-neutral-400" />
                          </div>
                        )}
                        {company.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <MapPin size={12} className="text-neutral-400" />
                        {company.city}, {company.country}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-neutral-600">
                      {company.companySize || "N/A"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Send size={14} className="text-neutral-500" />
                        <span className="font-medium">
                          {company.campaignCount || 0}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail size={14} className="text-neutral-500" />
                        <span className="font-medium">
                          {company.contactCount || 0}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          company.status === "ACTIVE"
                            ? "bg-neutral-900 text-white"
                            : company.status === "BLOCKED"
                              ? "bg-red-500 text-white"
                              : company.status === "SUSPENDED"
                                ? "bg-yellow-500 text-white"
                                : ""
                        }
                        variant={
                          company.status === "ACTIVE" ? "default" : "secondary"
                        }
                      >
                        {company.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>
                        {new Date(company.createdAt).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {new Date(company.createdAt).toLocaleTimeString()}
                      </div>
                    </TableCell>
                    <TableCell className="pl-6">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          router.push(`/dashboard/companies/${company._id}`)
                        }
                      >
                        View Details
                      </Button>
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
                total companies)
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={pagination.limit.toString()}
                  onValueChange={(value) => {
                    setPagination((prev) => ({
                      ...prev,
                      limit: parseInt(value),
                      page: 1,
                    }));
                  }}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>

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
    </div>
  );
}
