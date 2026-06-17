'use client';

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
import { Loader2 } from 'lucide-react';

export type ConfirmToggleRequest = {
  title: string;
  description: string;
  confirmLabel?: string;
};

type ConfirmToggleDialogProps = {
  request: ConfirmToggleRequest | null;
  saving?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmToggleDialog({
  request,
  saving = false,
  onConfirm,
  onCancel,
}: ConfirmToggleDialogProps) {
  return (
    <AlertDialog open={Boolean(request)} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{request?.title}</AlertDialogTitle>
          <AlertDialogDescription>{request?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving} onClick={onCancel}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction disabled={saving} onClick={onConfirm}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving
              </>
            ) : (
              request?.confirmLabel || 'Confirm'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
