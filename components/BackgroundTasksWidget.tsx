'use client';

import { useBackgroundTasks } from '@/context/BackgroundTasksContext';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { estimateProgressPercent } from '@/lib/archive-progress-weights';
import { Loader2, CheckCircle2, XCircle, X } from 'lucide-react';

const OP_LABEL: Record<string, string> = {
  archive: 'Archiving',
  delete: 'Deleting',
  restore: 'Restoring',
};

/**
 * Persistent bottom-right progress stack for company archive/delete/restore
 * operations — mounted once in the dashboard layout so it stays visible
 * across page navigation, independent of whichever dialog started the task.
 */
export function BackgroundTasksWidget() {
  const { tasks, dismissTask } = useBackgroundTasks();

  if (tasks.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {tasks.map((task) => {
        const pct = task.progress
          ? estimateProgressPercent(task.op, task.progress.step, task.progress.current, task.progress.total)
          : 0;
        return (
          <div key={task.id} className="rounded-lg border bg-card p-3 text-sm shadow-lg">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2 font-medium">
                {task.status === 'running' && (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                )}
                {task.status === 'success' && (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                )}
                {task.status === 'error' && <XCircle className="h-4 w-4 shrink-0 text-destructive" />}
                <span className="truncate">
                  {OP_LABEL[task.op]} {task.companyName}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => dismissTask(task.id)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            {task.status === 'running' && (
              <>
                <p className="mt-1 text-xs text-muted-foreground">
                  {task.progress ? `${task.progress.step} — ${task.progress.detail}` : 'Starting…'}
                </p>
                <Progress value={pct} className="mt-2 h-1.5" />
              </>
            )}

            {task.status === 'error' && (
              <p className="mt-1 text-xs text-destructive">{task.errorMessage}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
