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
import { AlertTriangle, Database, HardDrive } from 'lucide-react';
import { formatBytes, formatCount } from '@/app/dashboard/db-analytics/format';
import { useBackgroundTasks } from '@/context/BackgroundTasksContext';
import type { ArchivedCompanyRow } from '@/components/RestoreCompanyDialog';

export function DeleteArchivedCompanyDialog({
  open,
  onOpenChange,
  archived,
  onQueued,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  archived: ArchivedCompanyRow;
  /** Called once the deletion is handed off to the background — the dialog closes immediately, it doesn't wait for completion. */
  onQueued: () => void;
}) {
  const [password, setPassword] = useState('');
  const { startDeleteArchived } = useBackgroundTasks();

  useEffect(() => {
    if (!open) return;
    setPassword('');
  }, [open]);

  const totalDocuments = archived.dbCollections.reduce((s, c) => s + c.count, 0);

  const handleDelete = () => {
    startDeleteArchived({
      companyId: archived.companyId,
      companyName: archived.companyName,
      password,
      archivedRecordId: archived._id,
    });
    onOpenChange(false);
    onQueued();
  };

  const canDelete = password.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Permanently delete {archived.companyName}
          </DialogTitle>
          <DialogDescription>
            This permanently deletes the archived company and its backup — it can no longer be
            restored afterward. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Database className="h-4 w-4 text-muted-foreground" />
              Backed-up database data — will be permanently lost
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatCount(totalDocuments)} document(s) across {archived.dbCollections.length}{' '}
              collection(s)
            </p>
          </div>

          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              Backed-up AWS storage — will be permanently deleted
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatCount(archived.awsObjectCount)} file(s), {formatBytes(archived.awsBytes)} total
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="confirm-delete-archived-password" className="text-sm">
              Enter your admin password to confirm
            </Label>
            <Input
              id="confirm-delete-archived-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canDelete) handleDelete();
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={!canDelete}>
            Permanently delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
