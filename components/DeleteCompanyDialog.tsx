'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, AlertTriangle, Database, HardDrive, CreditCard } from 'lucide-react';
import { formatBytes, formatCount } from '@/app/dashboard/db-analytics/format';

type StripeSubscriptionItemRow = {
  productName: string | null;
  amount: number | null;
  currency: string | null;
  interval: string | null;
  quantity: number;
};

type StripeSubscriptionRow = {
  id: string;
  status: string;
  items: StripeSubscriptionItemRow[];
};

type DeletionPreview = {
  company: { id: string; name: string; status: string };
  db: {
    collections: { collectionName: string; count: number; size: number }[];
    totalDocuments: number;
    totalSize: number;
  };
  aws: { objects: number; bytes: number; buckets: { bucket: string; objects: number; bytes: number }[] } | null;
  stripe: { customerId: string | null; subscriptions: StripeSubscriptionRow[] };
};

function formatItemAmount(item: StripeSubscriptionItemRow) {
  if (item.amount == null || !item.currency) return null;
  const value = ((item.amount * item.quantity) / 100).toLocaleString(undefined, {
    style: 'currency',
    currency: item.currency.toUpperCase(),
  });
  return item.interval ? `${value} / ${item.interval}` : value;
}

export function DeleteCompanyDialog({
  open,
  onOpenChange,
  companyId,
  companyName,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName: string;
  onDeleted: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<DeletionPreview | null>(null);
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPreview(null);
    setError(null);
    setPassword('');
    setDeleteError(null);
    setLoading(true);

    (async () => {
      try {
        const res = await fetch(`/api/companies/${companyId}/deletion-preview`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to load deletion preview');
        setPreview(data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load deletion preview');
      } finally {
        setLoading(false);
      }
    })();
  }, [open, companyId]);

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/companies/${companyId}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to delete company');
      onOpenChange(false);
      onDeleted();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete company');
    } finally {
      setDeleting(false);
    }
  };

  const canDelete = password.length > 0 && !loading && !error;

  return (
    <Dialog open={open} onOpenChange={(next) => !deleting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete {companyName}
          </DialogTitle>
          <DialogDescription>
            This permanently deletes the company and cannot be undone. Review what will be
            removed before confirming.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Pulling database and storage usage…
          </div>
        ) : error ? (
          <p className="py-6 text-sm text-destructive">{error}</p>
        ) : preview ? (
          <div className="space-y-4">
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Database className="h-4 w-4 text-muted-foreground" />
                Database data — will be deleted
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatCount(preview.db.totalDocuments)} document(s) across{' '}
                {preview.db.collections.length} collection(s), {formatBytes(preview.db.totalSize)} total
              </p>
              {preview.db.collections.length > 0 && (
                <>
                  <div className="mt-2 grid grid-cols-[1fr_5rem_5rem] gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
                    <span>Collection</span>
                    <span className="text-center">Documents</span>
                    <span className="text-center">Size</span>
                  </div>
                  <ul className="mt-1 space-y-1 text-xs text-muted-foreground max-h-24 overflow-y-auto">
                    {preview.db.collections.map((c) => (
                      <li
                        key={c.collectionName}
                        className="grid grid-cols-[1fr_5rem_5rem] items-center gap-2"
                      >
                        <span className="font-mono truncate">{c.collectionName}</span>
                        <span className="text-center">{c.count < 0 ? '—' : formatCount(c.count)}</span>
                        <span className="text-center">{c.count < 0 ? 'unknown' : formatBytes(c.size)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <HardDrive className="h-4 w-4 text-muted-foreground" />
                AWS storage — will be deleted
              </div>
              {preview.aws && preview.aws.objects > 0 ? (
                <>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatCount(preview.aws.objects)} file(s), {formatBytes(preview.aws.bytes)} total
                  </p>
                  <div className="mt-2 grid grid-cols-[1fr_5rem_5rem] gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
                    <span>Bucket</span>
                    <span className="text-center">Files</span>
                    <span className="text-center">Size</span>
                  </div>
                  <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                    {preview.aws.buckets.map((b) => (
                      <li key={b.bucket} className="grid grid-cols-[1fr_5rem_5rem] items-center gap-2">
                        <span className="font-mono truncate">{b.bucket}</span>
                        <span className="text-center">{formatCount(b.objects)}</span>
                        <span className="text-center">{formatBytes(b.bytes)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  No S3 files found for this company, or usage hasn't been scanned yet (visit AWS
                  Analytics first to be sure).
                </p>
              )}
            </div>

            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                Stripe subscriptions — will be cancelled immediately
              </div>
              {preview.stripe.subscriptions.length > 0 ? (
                <ul className="mt-2 space-y-3 text-xs">
                  {preview.stripe.subscriptions.map((sub) => (
                    <li key={sub.id}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-muted-foreground">{sub.id}</span>
                        <Badge variant="outline" className="font-normal shrink-0">
                          {sub.status}
                        </Badge>
                      </div>
                      <ul className="mt-1 space-y-1 pl-3 border-l">
                        {sub.items.map((item, i) => (
                          <li key={i} className="flex items-center justify-between gap-2">
                            <span>
                              {item.productName || 'Unknown product'}
                              {item.quantity > 1 ? ` × ${item.quantity}` : ''}
                            </span>
                            <span className="text-muted-foreground shrink-0">
                              {formatItemAmount(item) ?? '—'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  {preview.stripe.customerId
                    ? 'No active subscriptions to cancel.'
                    : 'No Stripe customer on this company.'}
                </p>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="confirm-admin-password" className="text-sm">
                Enter your admin password to confirm
              </Label>
              <Input
                id="confirm-admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                disabled={deleting}
              />
            </div>

            {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={!canDelete || deleting}>
            {deleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting…
              </>
            ) : (
              'Permanently delete'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
