'use client';

import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type UnsavedChangesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function UnsavedChangesDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
}: UnsavedChangesDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onCancel();
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-3">
            <div className="rounded-full bg-muted p-2">
              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            </div>
            <DialogTitle>Unsaved Changes</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            You have unsaved changes. Are you sure you want to leave? Your changes will be lost.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => {
              onCancel();
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            Discard Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
