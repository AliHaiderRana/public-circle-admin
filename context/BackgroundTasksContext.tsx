'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { toast } from 'sonner';

type TaskOp = 'archive' | 'delete' | 'restore';

type ProgressInfo = { step: string; detail: string; current?: number; total?: number } | null;

export type BackgroundTask = {
  id: string;
  companyId: string;
  companyName: string;
  op: TaskOp;
  status: 'running' | 'success' | 'error';
  progress: ProgressInfo;
  errorMessage?: string;
};

type StartParams = {
  companyId: string;
  companyName: string;
  password: string;
};

const OP_VERB: Record<TaskOp, string> = {
  archive: 'archive',
  delete: 'delete',
  restore: 'restore',
};

const OP_PAST: Record<TaskOp, string> = {
  archive: 'archived',
  delete: 'permanently deleted',
  restore: 'restored',
};

type BackgroundTasksContextValue = {
  tasks: BackgroundTask[];
  startArchive: (params: StartParams) => void;
  startDelete: (params: StartParams) => void;
  startRestore: (params: StartParams & { archivedRecordId: string }) => void;
  dismissTask: (id: string) => void;
};

const BackgroundTasksContext = createContext<BackgroundTasksContextValue | null>(null);

export function useBackgroundTasks(): BackgroundTasksContextValue {
  const ctx = useContext(BackgroundTasksContext);
  if (!ctx) throw new Error('useBackgroundTasks must be used within BackgroundTasksProvider');
  return ctx;
}

/**
 * Runs company archive/delete/restore requests in the background, decoupled
 * from whichever dialog started them — mounted once in the dashboard layout
 * so the fetch (and this progress widget) survive client-side navigation
 * between pages, not just while a modal happens to stay open.
 */
export function BackgroundTasksProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);
  const pollTimers = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  const updateTask = useCallback((id: string, patch: Partial<BackgroundTask>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const stopPolling = useCallback((id: string) => {
    const timer = pollTimers.current.get(id);
    if (timer) {
      clearInterval(timer);
      pollTimers.current.delete(id);
    }
  }, []);

  const startPolling = useCallback(
    (id: string, companyId: string) => {
      const poll = async () => {
        try {
          const res = await fetch(`/api/companies/${companyId}/archive-progress`);
          const data = await res.json();
          if (res.ok) updateTask(id, { progress: data.data });
        } catch {
          // Ignore transient poll failures — the main request result still governs the outcome.
        }
      };
      void poll();
      pollTimers.current.set(id, setInterval(poll, 1000));
    },
    [updateTask]
  );

  const runTask = useCallback(
    (op: TaskOp, companyId: string, companyName: string, run: () => Promise<{ message?: string }>) => {
      const id = `${op}-${companyId}-${Date.now()}`;
      setTasks((prev) => [...prev, { id, companyId, companyName, op, status: 'running', progress: null }]);
      startPolling(id, companyId);

      run()
        .then((data) => {
          stopPolling(id);
          updateTask(id, { status: 'success' });
          toast.success(data?.message || `"${companyName}" ${OP_PAST[op]}`);
          setTimeout(() => setTasks((prev) => prev.filter((t) => t.id !== id)), 4000);
        })
        .catch((err) => {
          stopPolling(id);
          const message = err instanceof Error ? err.message : `Failed to ${OP_VERB[op]} company`;
          updateTask(id, { status: 'error', errorMessage: message });
          toast.error(message);
        });
    },
    [startPolling, stopPolling, updateTask]
  );

  const startArchive = useCallback(
    ({ companyId, companyName, password }: StartParams) => {
      runTask('archive', companyId, companyName, async () => {
        const res = await fetch(`/api/companies/${companyId}/archive`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to archive company');
        return data;
      });
    },
    [runTask]
  );

  const startDelete = useCallback(
    ({ companyId, companyName, password }: StartParams) => {
      runTask('delete', companyId, companyName, async () => {
        const res = await fetch(`/api/companies/${companyId}/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to delete company');
        return data;
      });
    },
    [runTask]
  );

  const startRestore = useCallback(
    ({ companyId, companyName, password, archivedRecordId }: StartParams & { archivedRecordId: string }) => {
      runTask('restore', companyId, companyName, async () => {
        const res = await fetch(`/api/companies/archived/${archivedRecordId}/restore`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to restore company');
        return data;
      });
    },
    [runTask]
  );

  const dismissTask = useCallback(
    (id: string) => {
      stopPolling(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    },
    [stopPolling]
  );

  return (
    <BackgroundTasksContext.Provider
      value={{ tasks, startArchive, startDelete, startRestore, dismissTask }}
    >
      {children}
    </BackgroundTasksContext.Provider>
  );
}
