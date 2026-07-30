// Ephemeral, in-memory step tracker for a running archive/delete/restore
// request — lets the client poll for granular progress ("backing up
// emails-sent (3/14)") while the main request is still in flight, without
// changing its otherwise synchronous, transactional behavior.
//
// Stored on `global` (same pattern as lib/db.ts's Mongoose connection cache)
// because Next.js can compile each API route into its own module instance in
// dev — a plain module-level Map would end up as a different object for the
// POST route vs. the GET progress-poll route, silently losing all updates.
// Local-process only by design; would need a shared store (Redis, etc.) to
// survive across separate serverless function instances in production.

export type ArchiveProgressState = {
  op: 'archive' | 'delete' | 'restore';
  step: string;
  detail: string;
  /** Sub-progress within this step (e.g. collection 3 of 14), when known — used to compute a percentage on the client. */
  current?: number;
  total?: number;
  updatedAt: number;
};

type ProgressStore = Map<string, ArchiveProgressState>;

const globalForProgress = global as typeof globalThis & { archiveProgressStore?: ProgressStore };

const progressStore: ProgressStore =
  globalForProgress.archiveProgressStore ?? (globalForProgress.archiveProgressStore = new Map());

export function setProgress(
  companyId: string,
  op: 'archive' | 'delete' | 'restore',
  step: string,
  detail: string,
  sub?: { current: number; total: number }
) {
  progressStore.set(companyId, {
    op,
    step,
    detail,
    current: sub?.current,
    total: sub?.total,
    updatedAt: Date.now(),
  });
}

export function getProgress(companyId: string): ArchiveProgressState | null {
  return progressStore.get(companyId) ?? null;
}

export function clearProgress(companyId: string) {
  progressStore.delete(companyId);
}
