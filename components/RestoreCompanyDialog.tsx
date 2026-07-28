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
import { Separator } from '@/components/ui/separator';
import { Loader2, ArchiveRestore, Database, HardDrive, CreditCard } from 'lucide-react';
import { formatBytes, formatCount } from '@/app/dashboard/db-analytics/format';

export type ArchivedCompanyRow = {
  _id: string;
  companyId: string;
  companyName: string;
  archivedAt: string;
  archivedBy: string;
  dbCollections: { collectionName: string; field: string; count: number }[];
  awsObjectCount: number;
  awsBytes: number;
  stripeCustomerId: string | null;
  stripeSubscriptions: { originalSubscriptionId: string; status: string; items: { productName: string | null; quantity: number }[] }[];
  status: 'archived' | 'restored' | 'restore_failed';
  restoreErrors: string[];
};

export function RestoreCompanyDialog({
  open,
  onOpenChange,
  archived,
  onRestored,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  archived: ArchivedCompanyRow;
  onRestored: () => void;
}) {
  const [password, setPassword] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPassword('');
    setRestoreError(null);
  }, [open]);

  const totalDocuments = archived.dbCollections.reduce((s, c) => s + c.count, 0);

  const handleRestore = async () => {
    setRestoring(true);
    setRestoreError(null);
    try {
      const res = await fetch(`/api/companies/archived/${archived._id}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to restore company');
      onOpenChange(false);
      onRestored();
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : 'Failed to restore company');
    } finally {
      setRestoring(false);
    }
  };

  const canRestore = password.length > 0;

  return (
    <Dialog open={open} onOpenChange={(next) => !restoring && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArchiveRestore className="h-5 w-5" />
            Restore {archived.companyName}
          </DialogTitle>
          <DialogDescription>
            Re-inserts its database documents, copies its S3 files back, and recreates its Stripe
            subscription(s) — as new subscriptions billed immediately (Stripe has no way to
            un-cancel one).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Database className="h-4 w-4 text-muted-foreground" />
              Database data — will be restored
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatCount(totalDocuments)} document(s) across {archived.dbCollections.length}{' '}
              collection(s)
            </p>
          </div>

          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              AWS storage — will be restored
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatCount(archived.awsObjectCount)} file(s), {formatBytes(archived.awsBytes)} total
            </p>
          </div>

          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              Stripe subscriptions — will be recreated and billed immediately
            </div>
            {archived.stripeSubscriptions.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {archived.stripeSubscriptions.map((sub) => (
                  <li key={sub.originalSubscriptionId}>
                    {sub.items.map((i) => i.productName || 'Unknown product').join(', ') || 'Subscription'}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                {archived.stripeCustomerId ? 'No subscriptions to recreate.' : 'No Stripe customer on this company.'}
              </p>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="confirm-restore-password" className="text-sm">
              Enter your admin password to confirm
            </Label>
            <Input
              id="confirm-restore-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              disabled={restoring}
            />
          </div>

          {restoreError && <p className="text-sm text-destructive">{restoreError}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={restoring}>
            Cancel
          </Button>
          <Button type="button" onClick={handleRestore} disabled={!canRestore || restoring}>
            {restoring ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Restoring…
              </>
            ) : (
              'Restore Company'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
