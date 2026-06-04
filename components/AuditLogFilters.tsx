'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw } from 'lucide-react';
import type { AuditSortOrder } from '@/lib/audit-query';

type AuditLogFiltersProps = {
  adminEmail?: string;
  onAdminEmailChange?: (value: string) => void;
  showAdminEmail?: boolean;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  sort: AuditSortOrder;
  onSortChange: (value: AuditSortOrder) => void;
  onRefresh: () => void;
  refreshing?: boolean;
  children?: React.ReactNode;
  title?: string;
  description?: string;
};

export default function AuditLogFilters({
  adminEmail = '',
  onAdminEmailChange,
  showAdminEmail = true,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  sort,
  onSortChange,
  onRefresh,
  refreshing = false,
  children,
  title = 'Filters',
  description = 'Narrow results by admin, date, and sort order.',
}: AuditLogFiltersProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-2"
            onClick={onRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {showAdminEmail && onAdminEmailChange ? (
          <div className="space-y-2">
            <Label htmlFor="audit-admin-email">Admin email</Label>
            <Input
              id="audit-admin-email"
              placeholder="Filter by admin email…"
              value={adminEmail}
              onChange={(e) => onAdminEmailChange(e.target.value)}
            />
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="audit-date-from">From date</Label>
          <Input
            id="audit-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-date-to">To date</Label>
          <Input
            id="audit-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-sort">Sort</Label>
          <Select value={sort} onValueChange={(v) => onSortChange(v as AuditSortOrder)}>
            <SelectTrigger id="audit-sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Newest first</SelectItem>
              <SelectItem value="asc">Oldest first</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
