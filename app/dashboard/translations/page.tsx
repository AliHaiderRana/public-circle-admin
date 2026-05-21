'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  Languages,
  Plus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Search,
  Globe,
} from 'lucide-react';
import {
  TRANSLATION_PREFIXES,
  TRANSLATION_KEY_EXAMPLES,
  TRANSLATION_KEY_PATTERN,
  LOCALE_CODE_PATTERN,
  TRANSLATION_PAGE_SIZES,
  type SupportedLocaleOption,
} from '@/lib/translation-constants';

type TranslationRow = {
  key: string;
  values: Record<string, string>;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

export default function TranslationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [prefix, setPrefix] = useState('global');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [rows, setRows] = useState<TranslationRow[]>([]);
  const [locales, setLocales] = useState<SupportedLocaleOption[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    pages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValues, setNewValues] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [langOpen, setLangOpen] = useState(false);
  const [newLangCode, setNewLangCode] = useState('');
  const [newLangLabel, setNewLangLabel] = useState('');
  const [newLangShort, setNewLangShort] = useState('');
  const [addingLang, setAddingLang] = useState(false);
  const [langError, setLangError] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);
  const backendUrl =
    typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      : 'http://localhost:3001';

  const emptyValues = useCallback(
    () => Object.fromEntries(locales.map((l) => [l.code, ''])),
    [locales]
  );

  const fetchLocales = useCallback(async () => {
    const res = await fetch('/api/translations/locales');
    const data = await res.json();
    const list = data.locales ?? [];
    setLocales(list);
    return list as SupportedLocaleOption[];
  }, []);

  const syncKeysToDb = useCallback(async (seedPrefix?: string) => {
    setSeeding(true);
    setSeedMessage(null);
    try {
      const target = seedPrefix ?? prefix;
      const res = await fetch(
        `/api/translations/seed?prefix=${encodeURIComponent(target)}`,
        { method: 'POST' }
      );
      const data = await res.json();
      if (!res.ok) {
        setSeedMessage(data.error || 'Failed to sync keys to database');
        return;
      }
      setSeedMessage(
        `Synced ${data.data?.count ?? 0} keys (${target}) to database via ${data.backend || backendUrl}.`
      );
    } catch {
      setSeedMessage('Failed to connect to API — check API_BASE_URL in admin .env');
    } finally {
      setSeeding(false);
    }
  }, [prefix, backendUrl]);

  const fetchTranslations = useCallback(async () => {
    setLoading(true);
    try {
      await fetch(
        `/api/translations/seed?prefix=${encodeURIComponent(prefix)}`,
        { method: 'POST' }
      );

      const params = new URLSearchParams({
        prefix,
        page: String(pagination.page),
        limit: String(pagination.limit),
      });
      if (search) params.set('search', search);

      const res = await fetch(`/api/translations?${params}`);
      const data = await res.json();
      setRows(
        (data.translations ?? []).map((t: TranslationRow) => ({
          key: t.key,
          values: { ...t.values },
        }))
      );
      if (data.pagination) setPagination(data.pagination);
    } catch {
      console.error('Failed to load translations');
    } finally {
      setLoading(false);
    }
  }, [prefix, search, pagination.page, pagination.limit]);

  useEffect(() => {
    if (!authLoading && user && !user.isSuperAdmin) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user?.isSuperAdmin) {
      fetchLocales().then((list) => {
        setNewValues(Object.fromEntries(list.map((l) => [l.code, ''])));
      });
    }
  }, [user, fetchLocales]);

  useEffect(() => {
    if (user?.isSuperAdmin && locales.length) {
      fetchTranslations();
    }
  }, [user, locales.length, fetchTranslations]);

  const handlePrefixChange = (next: string) => {
    setPrefix(next);
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const updateValue = (key: string, locale: string, value: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.key === key ? { ...row, values: { ...row.values, [locale]: value } } : row
      )
    );
  };

  const handleSave = async (row: TranslationRow) => {
    setSavingKey(row.key);
    setSaveError(null);
    try {
      const res = await fetch('/api/translations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: row.key, values: row.values }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error || `Failed to save ${row.key}`);
        return;
      }
      setRows((prev) =>
        prev.map((r) =>
          r.key === row.key ? { ...r, values: data.translation.values } : r
        )
      );
      setSaveError(null);
      setSeedMessage(`Saved "${row.key}" to database. Refresh public-circle (or refocus tab) to see changes.`);
    } catch {
      setSaveError(`Failed to save ${row.key}`);
    } finally {
      setSavingKey(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeletingKey(deleteTarget);
    try {
      const res = await fetch(
        `/api/translations?key=${encodeURIComponent(deleteTarget)}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        setDeleteTarget(null);
        await fetchTranslations();
      }
    } finally {
      setDeletingKey(null);
    }
  };

  const handleCreate = async () => {
    setCreateError('');
    const normalizedKey = newKey.trim().toLowerCase();
    if (!TRANSLATION_KEY_PATTERN.test(normalizedKey)) {
      setCreateError('Key must look like page.section.element');
      return;
    }
    if (locales.some((l) => !newValues[l.code]?.trim())) {
      setCreateError('Fill all locale values.');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/translations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: normalizedKey, values: newValues }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || 'Failed to create');
        return;
      }
      setAddOpen(false);
      setNewKey('');
      setNewValues(emptyValues());
      const pagePrefix = normalizedKey.split('.')[0];
      if (prefix === 'all' || normalizedKey.startsWith(`${prefix}.`)) {
        await fetchTranslations();
      } else {
        handlePrefixChange(pagePrefix);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleAddLanguage = async () => {
    setLangError('');
    const code = newLangCode.trim();
    if (!LOCALE_CODE_PATTERN.test(code)) {
      setLangError('Use a code like de or es-MX');
      return;
    }
    if (!newLangLabel.trim()) {
      setLangError('Display label is required');
      return;
    }

    setAddingLang(true);
    try {
      const res = await fetch('/api/translations/locales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          label: newLangLabel,
          short: newLangShort || code.split('-')[0].toUpperCase(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLangError(data.error || 'Failed to add language');
        return;
      }
      setLangOpen(false);
      setNewLangCode('');
      setNewLangLabel('');
      setNewLangShort('');
      const list = await fetchLocales();
      setNewValues(Object.fromEntries(list.map((l) => [l.code, ''])));
      await fetchTranslations();
    } finally {
      setAddingLang(false);
    }
  };

  if (authLoading || !user?.isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Languages className="h-7 w-7" />
            Translations
          </h1>
          <p className="text-muted-foreground mt-1 max-w-xl text-sm">
            Filter by screen, edit values, click <strong>Save</strong> — stored in MongoDB.
            Public-circle loads all keys from the same API ({backendUrl}).
          </p>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          <Button
            variant="outline"
            disabled={seeding}
            onClick={() => syncKeysToDb(prefix)}
          >
            {seeding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Sync keys to DB'
            )}
          </Button>
          <Dialog open={langOpen} onOpenChange={setLangOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Globe className="h-4 w-4 mr-2" />
                Add language
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add language</DialogTitle>
                <DialogDescription>
                  New locale appears in public-circle header. Existing keys copy English (US) as a starting value.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1">
                  <Label>Code</Label>
                  <Input
                    placeholder="de or es-MX"
                    value={newLangCode}
                    onChange={(e) => setNewLangCode(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Display name</Label>
                  <Input
                    placeholder="German"
                    value={newLangLabel}
                    onChange={(e) => setNewLangLabel(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Short code (header)</Label>
                  <Input
                    placeholder="DE"
                    maxLength={6}
                    value={newLangShort}
                    onChange={(e) => setNewLangShort(e.target.value)}
                  />
                </div>
                {langError && <p className="text-sm text-destructive">{langError}</p>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setLangOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddLanguage} disabled={addingLang}>
                  {addingLang ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add translation
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>New translation key</DialogTitle>
                <DialogDescription>
                  Example: {TRANSLATION_KEY_EXAMPLES[0]}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1">
                  <Label>Key</Label>
                  <Input
                    className="font-mono text-sm"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                  />
                </div>
                {locales.map((loc) => (
                  <div key={loc.code} className="space-y-1">
                    <Label className="text-xs">{loc.label}</Label>
                    <Textarea
                      rows={2}
                      value={newValues[loc.code] ?? ''}
                      onChange={(e) =>
                        setNewValues((v) => ({ ...v, [loc.code]: e.target.value }))
                      }
                    />
                  </div>
                ))}
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
      </div>

      <Card>
        <CardContent className="pt-4 flex flex-wrap gap-2 items-center">
          <span className="text-sm text-muted-foreground">Languages:</span>
          {locales.map((loc) => (
            <Badge key={loc.code} variant="outline">
              {loc.label} ({loc.code})
            </Badge>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {TRANSLATION_PREFIXES.map((p) => (
            <Button
              key={p.id}
              variant={prefix === p.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePrefixChange(p.id)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <form onSubmit={handleSearchSubmit} className="flex gap-2 flex-1 min-w-[200px]">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search keys or English (US) text…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>
        {search ? (
          <p className="text-xs text-muted-foreground w-full sm:w-auto">
            Matching key or English (US): <span className="font-medium">{search}</span>
          </p>
        ) : null}
      </div>

      {seedMessage && (
        <p className="text-sm text-muted-foreground rounded-md border bg-muted/40 px-3 py-2">
          {seedMessage}
        </p>
      )}

      {saveError && (
        <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
          {saveError}
        </p>
      )}

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Per page</span>
        <Select
          value={String(pagination.limit)}
          onValueChange={(v) =>
            setPagination((p) => ({ ...p, limit: parseInt(v, 10), page: 1 }))
          }
        >
          <SelectTrigger className="w-[80px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRANSLATION_PAGE_SIZES.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!loading && (
          <span className="ml-auto">
            {pagination.total} key{pagination.total !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground space-y-3">
            <p>No translations in database for this filter.</p>
            <Button variant="secondary" size="sm" onClick={() => syncKeysToDb(prefix)} disabled={seeding}>
              Sync keys to DB
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <Card key={row.key}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-sm font-mono font-normal break-all">
                      {row.key}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      <code className="text-xs">t(&apos;{row.key}&apos;)</code>
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(row.key)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {locales.map((loc) => (
                  <div key={loc.code} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{loc.label}</Label>
                    <Textarea
                      rows={2}
                      value={row.values[loc.code] ?? ''}
                      onChange={(e) => updateValue(row.key, loc.code, e.target.value)}
                    />
                  </div>
                ))}
                <div className="flex justify-end pt-1">
                  <Button
                    size="sm"
                    disabled={savingKey === row.key}
                    onClick={() => handleSave(row)}
                  >
                    {savingKey === row.key ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Save'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pagination.pages > 1 && (
        <div className="flex items-center justify-between border-t pt-4">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.pages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.pages}
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete translation?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes <code className="text-xs">{deleteTarget}</code> in all
              languages. public-circle will use the fallback chain until you add the key again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingKey}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!!deletingKey}
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
            >
              {deletingKey ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting…
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
