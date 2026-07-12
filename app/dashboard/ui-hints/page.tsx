'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChevronLeft, ChevronRight, Info, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import {
  LOCALE_DISPLAY_NAMES,
  TERM_META,
  UI_TERM_KEY_EXAMPLES,
  UI_TERM_KEY_PATTERN,
  validateFeConstant,
  validateUiTermKey,
  feHintUsage,
  type UiTermRow,
} from '@/lib/ui-term-constants';

type LocaleOption = { code: string; label: string };

const PAGE_SIZES = [5, 10, 20] as const;
const DEFAULT_SEARCH_LOCALE = 'en-US';

type SearchScope = 'key' | 'enUS' | 'any';

const FALLBACK_LOCALES: LocaleOption[] = [
  { code: 'en-US', label: LOCALE_DISPLAY_NAMES['en-US'] },
  { code: 'en-GB', label: LOCALE_DISPLAY_NAMES['en-GB'] },
  { code: 'en-CA', label: LOCALE_DISPLAY_NAMES['en-CA'] },
  { code: 'fr', label: LOCALE_DISPLAY_NAMES.fr },
];

function localeFillCount(term: UiTermRow, localeCodes: string[]): number {
  return localeCodes.filter((code) => term.descriptions[code]?.trim()).length;
}

export default function UiHintsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [terms, setTerms] = useState<UiTermRow[]>([]);
  const [locales, setLocales] = useState<LocaleOption[]>(FALLBACK_LOCALES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchScope, setSearchScope] = useState<SearchScope>('any');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number>(10);
  const [editOpen, setEditOpen] = useState(false);
  const [editTerm, setEditTerm] = useState<UiTermRow | null>(null);
  const [editDescriptions, setEditDescriptions] = useState<Record<string, string>>({});
  const [editLocaleTab, setEditLocaleTab] = useState('en-US');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UiTermRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newFeConstant, setNewFeConstant] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [editFeConstant, setEditFeConstant] = useState('');
  const [newDescriptions, setNewDescriptions] = useState<Record<string, string>>({});
  const [newLocaleTab, setNewLocaleTab] = useState(DEFAULT_SEARCH_LOCALE);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const localeCodes = useMemo(() => locales.map((l) => l.code), [locales]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [termsRes, localesRes] = await Promise.all([
        fetch('/api/ui-terms'),
        fetch('/api/translations/locales'),
      ]);
      const termsData = await termsRes.json();
      const localesData = await localesRes.json();

      const loadedLocales = (localesData.locales ?? []) as LocaleOption[];
      if (loadedLocales.length) setLocales(loadedLocales);

      if (!termsRes.ok) {
        setTerms([]);
        setError(termsData.error || 'Could not load context help. Check MONGODB_URI in admin .env.');
        return;
      }

      setTerms((termsData.terms ?? []) as UiTermRow[]);
    } catch {
      setTerms([]);
      setError('Could not reach the database. Check MONGODB_URI in admin .env.');
    } finally {
      setLoading(false);
    }
  }, []);

  const filteredTerms = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return terms;

    return terms.filter((term) => {
      const keyHaystack = [
        term.key,
        term.label,
        term.feConstant,
        feHintUsage(term),
        TERM_META[term.key]?.where ?? '',
      ]
        .join(' ')
        .toLowerCase();

      const enUsText = (term.descriptions[DEFAULT_SEARCH_LOCALE] ?? '').toLowerCase();

      if (searchScope === 'key') return keyHaystack.includes(q);
      if (searchScope === 'enUS') return enUsText.includes(q);
      return keyHaystack.includes(q) || enUsText.includes(q);
    });
  }, [terms, search, searchScope]);

  const total = filteredTerms.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, pages);

  const paginatedTerms = useMemo(() => {
    const start = (safePage - 1) * limit;
    return filteredTerms.slice(start, start + limit);
  }, [filteredTerms, safePage, limit]);

  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  useEffect(() => {
    if (!savedNote) return;
    const t = setTimeout(() => setSavedNote(null), 4000);
    return () => clearTimeout(t);
  }, [savedNote]);

  const openEdit = (term: UiTermRow) => {
    setEditTerm(term);
    setEditFeConstant(term.feConstant ?? '');
    const desc: Record<string, string> = {};
    for (const loc of locales) {
      desc[loc.code] = term.descriptions[loc.code] ?? '';
    }
    setEditDescriptions(desc);
    setEditLocaleTab(DEFAULT_SEARCH_LOCALE);
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!editTerm) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/ui-terms', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: editTerm.key,
          label: editTerm.label,
          feConstant: editFeConstant,
          descriptions: editDescriptions,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save');
        return;
      }
      setEditOpen(false);
      setEditTerm(null);
      setSavedNote('Changes saved.');
      await load();
    } finally {
      setSaving(false);
    }
  };

  const openAdd = () => {
    setNewKey('');
    setNewFeConstant('');
    setNewLabel('');
    setNewDescriptions(Object.fromEntries(localeCodes.map((code) => [code, ''])));
    setNewLocaleTab(DEFAULT_SEARCH_LOCALE);
    setCreateError('');
    setAddOpen(true);
  };

  const handleCreate = async () => {
    setCreateError('');
    const keyInput = newKey.trim().toLowerCase();
    try {
      validateUiTermKey(keyInput);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Invalid key');
      return;
    }
    if (terms.some((t) => t.key === keyInput)) {
      setCreateError(`Key "${keyInput}" already exists. Edit it instead.`);
      return;
    }
    if (!newLabel.trim()) {
      setCreateError('Label is required');
      return;
    }
    try {
      validateFeConstant(newFeConstant);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Invalid FE constant');
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/ui-terms', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: keyInput,
          label: newLabel.trim(),
          feConstant: newFeConstant.trim(),
          descriptions: newDescriptions,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || 'Failed to create');
        return;
      }
      setAddOpen(false);
      setSavedNote(`Created "${keyInput}".`);
      await load();
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/ui-terms?key=${encodeURIComponent(deleteTarget.key)}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to delete');
        return;
      }
      setDeleteTarget(null);
      setSavedNote(`Deleted "${deleteTarget.key}".`);
      await load();
    } finally {
      setDeleting(false);
    }
  };

  const editMeta = editTerm ? TERM_META[editTerm.key] : null;
  const rangeStart = total === 0 ? 0 : (safePage - 1) * limit + 1;
  const rangeEnd = Math.min(safePage * limit, total);

  if (authLoading || !user) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Context help</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Each row in <code className="rounded bg-muted px-1 text-xs">ui-terms</code> stores{' '}
            <code className="text-xs">key</code> (e.g. audience.fields) and{' '}
            <code className="text-xs">feConstant</code> (e.g. audienceFields) in MongoDB.
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add context help
        </Button>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New context help key</DialogTitle>
              <DialogDescription>
                Example: {UI_TERM_KEY_EXAMPLES[0]}. Saved to the{' '}
                <code className="text-xs">ui-terms</code> collection.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label>Key</Label>
                <Input
                  className="font-mono text-sm"
                  placeholder={UI_TERM_KEY_EXAMPLES[0]}
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Pattern: {UI_TERM_KEY_PATTERN.source}
                </p>
              </div>
              <div className="space-y-1">
                <Label>FE constant (stored in DB)</Label>
                <Input
                  className="font-mono text-sm"
                  placeholder="audienceFields"
                  value={newFeConstant}
                  onChange={(e) => setNewFeConstant(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Used in code as UI_HINT_KEYS.{newFeConstant || '…'}
                </p>
              </div>
              <div className="space-y-1">
                <Label>Label (admin display)</Label>
                <Input
                  placeholder="Fields"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                />
              </div>
              <Tabs value={newLocaleTab} onValueChange={setNewLocaleTab}>
                <TabsList className="flex h-auto w-full flex-wrap gap-1">
                  {locales.map((loc) => (
                    <TabsTrigger key={loc.code} value={loc.code}>
                      {loc.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {locales.map((loc) => (
                  <TabsContent key={loc.code} value={loc.code} className="space-y-2 pt-2">
                    <Label>Tooltip ({loc.label})</Label>
                    <Textarea
                      rows={4}
                      placeholder="Required for every language before save…"
                      value={newDescriptions[loc.code] ?? ''}
                      onChange={(e) =>
                        setNewDescriptions((d) => ({ ...d, [loc.code]: e.target.value }))
                      }
                    />
                  </TabsContent>
                ))}
              </Tabs>
              {createError && <p className="text-sm text-destructive">{createError}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {savedNote && (
        <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          {savedNote}
        </p>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="gap-0 py-0">
        <div className="flex flex-col gap-4 border-b p-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Keys</h2>
            <p className="text-sm text-muted-foreground">
              Edit opens all languages. Table shows English (US) preview only.
            </p>
          </div>
          <form
            onSubmit={handleSearchSubmit}
            className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:max-w-xl"
          >
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <Select
              value={searchScope}
              onValueChange={(v) => {
                setSearchScope(v as SearchScope);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Key or English (US)</SelectItem>
                <SelectItem value="key">Key only</SelectItem>
                <SelectItem value="enUS">English (US) only</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" variant="secondary" size="sm" className="shrink-0">
              Search
            </Button>
          </form>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5 text-sm text-muted-foreground">
          <span>Per page</span>
          <Select
            value={String(limit)}
            onValueChange={(v) => {
              setLimit(parseInt(v, 10));
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-[72px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!loading && total > 0 && (
            <span className="ml-auto tabular-nums">
              Showing {rangeStart}–{rangeEnd} of {total} key{total !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : terms.length === 0 ? (
            <p className="py-16 text-center text-muted-foreground">No context help keys yet.</p>
          ) : total === 0 ? (
            <p className="py-16 text-center text-muted-foreground">No keys match your search.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Key</TableHead>
                  <TableHead className="w-[140px]">FE constant</TableHead>
                  <TableHead className="w-[100px]">Label</TableHead>
                  <TableHead className="w-[180px]">Where</TableHead>
                  <TableHead>Tooltip (English US)</TableHead>
                  <TableHead className="w-[72px] text-center">Locales</TableHead>
                  <TableHead className="w-[88px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTerms.map((term) => {
                  const enUs = term.descriptions[DEFAULT_SEARCH_LOCALE]?.trim();
                  const filled = localeFillCount(term, localeCodes);
                  return (
                    <TableRow key={term.key}>
                      <TableCell className="align-top">
                        <code className="font-mono text-xs font-medium text-foreground">
                          {term.key}
                        </code>
                      </TableCell>
                      <TableCell className="align-top font-mono text-xs text-muted-foreground">
                        {term.feConstant ? (
                          <>UI_HINT_KEYS.{term.feConstant}</>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="align-top text-sm font-medium">{term.label}</TableCell>
                      <TableCell className="align-top text-sm text-muted-foreground">
                        {TERM_META[term.key]?.where ?? '—'}
                      </TableCell>
                      <TableCell className="align-top">
                        {enUs ? (
                          <p
                            className="line-clamp-3 text-sm leading-relaxed text-muted-foreground"
                            title={enUs}
                          >
                            {enUs}
                          </p>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="align-top text-center">
                        <Badge
                          variant={filled === localeCodes.length ? 'secondary' : 'outline'}
                          className="tabular-nums"
                        >
                          {filled}/{localeCodes.length}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-top text-right">
                        <div className="flex justify-end gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Edit all languages"
                            onClick={() => openEdit(term)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            title="Delete key"
                            onClick={() => setDeleteTarget(term)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {!loading && total > 0 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Page {safePage} of {pages}
                <span className="hidden sm:inline">
                  {' '}
                  · {total} key{total !== 1 ? 's' : ''}
                </span>
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage >= pages}
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                >
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2 rounded-lg border border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          In public-circle:{' '}
          <code className="rounded bg-muted px-1 text-xs">
            {'<EntityInfoHint termKey={UI_HINT_KEYS.audienceFields} />'}
          </code>
          . Other languages are edited in the dialog — not shown in the table to keep rows readable.
        </p>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editTerm?.label ?? 'Edit tooltip'}</DialogTitle>
            {editMeta?.where && (
              <DialogDescription>{editMeta.where}</DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Key (read-only)</Label>
              <Input className="font-mono text-sm" value={editTerm?.key ?? ''} readOnly />
            </div>
            <div className="space-y-1">
              <Label>FE constant (in DB)</Label>
              <Input
                className="font-mono text-sm"
                value={editFeConstant}
                onChange={(e) => setEditFeConstant(e.target.value)}
              />
              {editTerm && (
                <p className="text-xs text-muted-foreground">
                  termKey={'{'}
                  {feHintUsage({ key: editTerm.key, feConstant: editFeConstant })}
                  {'}'}
                </p>
              )}
            </div>
          </div>

          <Tabs value={editLocaleTab} onValueChange={setEditLocaleTab}>
            <TabsList className="flex h-auto w-full flex-wrap gap-1">
              {locales.map((loc) => (
                <TabsTrigger key={loc.code} value={loc.code}>
                  {loc.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {locales.map((loc) => (
              <TabsContent key={loc.code} value={loc.code} className="space-y-2 pt-2">
                <Label htmlFor={`tooltip-${loc.code}`}>Tooltip ({loc.label})</Label>
                <Textarea
                  id={`tooltip-${loc.code}`}
                  rows={5}
                  className="min-h-[120px] resize-y"
                  placeholder="Text shown when users hover the info icon…"
                  value={editDescriptions[loc.code] ?? ''}
                  onChange={(e) =>
                    setEditDescriptions((d) => ({ ...d, [loc.code]: e.target.value }))
                  }
                />
              </TabsContent>
            ))}
          </Tabs>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete context help key?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes <code className="font-mono text-sm">{deleteTarget?.key}</code> from
              MongoDB. public-circle will fall back to built-in defaults for known keys, or show
              no tooltip if none exists.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
