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
import { ArchiveRestore, Database, HardDrive, CreditCard } from 'lucide-react';
import { formatBytes, formatCount } from '@/app/dashboard/db-analytics/format';
import { useBackgroundTasks } from '@/context/BackgroundTasksContext';

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
  onQueued,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  archived: ArchivedCompanyRow;
  /** Called once the restore is handed off to the background — the dialog closes immediately, it doesn't wait for completion. */
  onQueued: () => void;
}) {
  const [password, setPassword] = useState('');
  const { startRestore } = useBackgroundTasks();

  useEffect(() => {
    if (!open) return;
    setPassword('');
  }, [open]);

  const totalDocuments = archived.dbCollections.reduce((s, c) => s + c.count, 0);

  const handleRestore = () => {
    startRestore({
      companyId: archived.companyId,
      companyName: archived.companyName,
      password,
      archivedRecordId: archived._id,
    });
    onOpenChange(false);
    onQueued();
  };

  const canRestore = password.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArchiveRestore className="h-5 w-5" />
            Restore {archived.companyName}
          </DialogTitle>
          <DialogDescription>
            Re-inserts its database documents, copies its S3 files back, and resumes its paused
            Stripe subscription(s) — same subscription(s), no new charge.
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
              Stripe subscriptions — will resume (no new charge)
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
                {archived.stripeCustomerId ? 'No paused subscriptions to resume.' : 'No Stripe customer on this company.'}
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
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canRestore) handleRestore();
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleRestore} disabled={!canRestore}>
            Restore Company
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
