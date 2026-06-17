type ChangelogItem = { text: string; commitSha?: string | null; commitAuthor?: string | null; commitAuthorEmail?: string | null; commitDate?: string | null };

/** Normalize a mixed array of strings or objects to the ChangelogItem object shape. */
export function normalizeItems(items: unknown): ChangelogItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (typeof item === 'string') return { text: item, commitSha: null, commitAuthor: null, commitAuthorEmail: null, commitDate: null };
      if (item && typeof item === 'object' && 'text' in item) return item as ChangelogItem;
      return null;
    })
    .filter((item): item is ChangelogItem => Boolean(item?.text));
}
