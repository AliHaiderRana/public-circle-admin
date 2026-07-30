// Client-side estimate of overall % complete for the archive/delete/restore
// progress bar. Steps aren't equal-cost (backing up a 20K-document
// collection takes far longer than cancelling a Stripe subscription), so
// each step gets a fixed weight range reflecting its typical share of the
// total work; within a step, current/total (e.g. collection 3 of 14)
// interpolates smoothly across that range.

type WeightRange = [number, number];

const WEIGHTS: Record<'archive' | 'delete' | 'restore' | 'purge', Record<string, WeightRange>> = {
  archive: {
    Scanning: [0, 5],
    'Backing up database': [5, 40],
    'Scanning AWS storage': [40, 45],
    'Backing up AWS storage': [45, 55],
    Stripe: [55, 60],
    'Removing live AWS files': [60, 65],
    'Removing live database records': [65, 95],
    Finalizing: [95, 100],
  },
  delete: {
    Stripe: [0, 15],
    'Removing AWS files': [15, 35],
    'Removing database records': [35, 100],
  },
  restore: {
    'Restoring database records': [0, 50],
    'Restoring AWS files': [50, 80],
    Stripe: [80, 90],
    Finalizing: [90, 100],
  },
  purge: {
    'Deleting backup files': [0, 70],
    'Deleting company record': [70, 100],
  },
};

export function estimateProgressPercent(
  op: 'archive' | 'delete' | 'restore' | 'purge',
  step: string,
  current?: number,
  total?: number
): number {
  const range = WEIGHTS[op]?.[step];
  if (!range) return 0;
  const [start, end] = range;
  const fraction = total && total > 0 && current != null ? Math.min(current / total, 1) : 0.5;
  return Math.round(start + fraction * (end - start));
}
