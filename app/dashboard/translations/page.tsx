'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Loader2,
  Languages,
  Plus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Search,
  Globe,
  Pencil,
  Settings2,
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

type AdminTableConfig = {
  showKeyColumn: boolean;
  visibleLocales: Record<string, boolean>;
};

type SearchScope = 'key' | 'values' | 'any';

export default function TranslationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [prefix, setPrefix] = useState('global');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchScope, setSearchScope] = useState<SearchScope>('any');
  const [rows, setRows] = useState<TranslationRow[]>([]);
  const [locales, setLocales] = useState<SupportedLocaleOption[]>([]);
  const [tableConfig, setTableConfig] = useState<AdminTableConfig>({
    showKeyColumn: true,
    visibleLocales: {},
  });
  const [configDraft, setConfigDraft] = useState<AdminTableConfig | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    pages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [deleteKeyTarget, setDeleteKeyTarget] = useState<string | null>(null);
  const [deleteLocaleTarget, setDeleteLocaleTarget] = useState<SupportedLocaleOption | null>(null);
  const [deletingLocale, setDeletingLocale] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<TranslationRow | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const [addOpen, setAddOpen] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValues, setNewValues] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [langOpen, setLangOpen] = useState(false);
  const [manageLangOpen, setManageLangOpen] = useState(false);
  const [newLangCode, setNewLangCode] = useState('');
  const [newLangLabel, setNewLangLabel] = useState('');
  const [newLangShort, setNewLangShort] = useState('');
  const [addingLang, setAddingLang] = useState(false);
  const [langError, setLangError] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const emptyValues = useCallback(
    () => Object.fromEntries(locales.map((l) => [l.code, ''])),
    [locales]
  );

  const visibleLocaleColumns = useMemo(
    () =>
      locales.filter(
        (loc) => tableConfig.visibleLocales[loc.code] !== false
      ),
    [locales, tableConfig.visibleLocales]
  );

  const fetchLocales = useCallback(async () => {
    const res = await fetch('/api/translations/locales');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const hint = data.hint ? ` ${data.hint}` : '';
      setBackendError(
        (data.error || 'Failed to load languages') +
          hint +
          ' (admin calls → http://localhost:3001)'
      );
      setLocales([]);
      return [];
    }
    setBackendError(null);
    const list = (data.locales ?? []) as SupportedLocaleOption[];
    setLocales(list);
    return list;
  }, []);

  const fetchTableConfig = useCallback(async () => {
    const res = await fetch('/api/translations/admin-config');
    if (!res.ok) return null;
    const data = await res.json();
    const config = data.config as AdminTableConfig;
    setTableConfig(config);
    return config;
  }, []);

  const fetchTranslations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        prefix,
        page: String(pagination.page),
        limit: String(pagination.limit),
        searchScope,
      });
      if (search) params.set('search', search);

      const res = await fetch(`/api/translations?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error || 'Failed to load translations');
        return;
      }
      setRows(
        (data.translations ?? []).map((t: TranslationRow) => ({
          key: t.key,
          values: { ...t.values },
        }))
      );
      if (data.pagination) setPagination(data.pagination);
      setSaveError(null);
    } catch {
      setSaveError('Failed to connect to backend — check API_BASE_URL in admin .env');
    } finally {
      setLoading(false);
    }
  }, [prefix, search, searchScope, pagination.page, pagination.limit]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      Promise.all([fetchLocales(), fetchTableConfig()]).then((list) => {
        const localesList = list[0] ?? [];
        setNewValues(Object.fromEntries(localesList.map((l) => [l.code, ''])));
      });
    }
  }, [user, fetchLocales, fetchTableConfig]);

  useEffect(() => {
    if (user && locales.length && !backendError) {
      fetchTranslations();
    } else if (user && backendError) {
      setLoading(false);
    }
  }, [user, locales.length, backendError, fetchTranslations]);

  const handlePrefixChange = (next: string) => {
    setPrefix(next);
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const openEdit = (row: TranslationRow) => {
    setEditRow(row);
    setEditValues({ ...row.values });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editRow) return;
    setSavingKey(editRow.key);
    setSaveError(null);
    try {
      const res = await fetch('/api/translations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: editRow.key, values: editValues }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error || `Failed to save ${editRow.key}`);
        return;
      }
      setRows((prev) =>
        prev.map((r) =>
          r.key === editRow.key ? { ...r, values: data.translation.values } : r
        )
      );
      setEditOpen(false);
      setEditRow(null);
      setStatusMessage(`Saved "${editRow.key}" to database.`);
    } catch {
      setSaveError(`Failed to save ${editRow.key}`);
    } finally {
      setSavingKey(null);
    }
  };

  const confirmDeleteKey = async () => {
    if (!deleteKeyTarget) return;
    setDeletingKey(deleteKeyTarget);
    try {
      const res = await fetch(
        `/api/translations?key=${encodeURIComponent(deleteKeyTarget)}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        setDeleteKeyTarget(null);
        await fetchTranslations();
        setStatusMessage(`Deleted "${deleteKeyTarget}".`);
      }
    } finally {
      setDeletingKey(null);
    }
  };

  const confirmDeleteLocale = async () => {
    if (!deleteLocaleTarget) return;
    setDeletingLocale(true);
    try {
      const res = await fetch(
        `/api/translations/locales/${encodeURIComponent(deleteLocaleTarget.code)}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) {
        setLangError(data.error || 'Failed to delete language');
        return;
      }
      setDeleteLocaleTarget(null);
      const list = await fetchLocales();
      await fetchTableConfig();
      setNewValues(Object.fromEntries(list.map((l) => [l.code, ''])));
      await fetchTranslations();
      setStatusMessage(`Deleted language "${deleteLocaleTarget.label}".`);
    } catch {
      setLangError('Failed to delete language');
    } finally {
      setDeletingLocale(false);
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
      setStatusMessage(`Created "${normalizedKey}".`);
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
      await fetchTableConfig();
      setNewValues(Object.fromEntries(list.map((l) => [l.code, ''])));
      await fetchTranslations();
      setStatusMessage(`Added language "${newLangLabel}".`);
    } finally {
      setAddingLang(false);
    }
  };

  const openColumnConfig = () => {
    setConfigDraft({
      showKeyColumn: tableConfig.showKeyColumn,
      visibleLocales: { ...tableConfig.visibleLocales },
    });
    setConfigOpen(true);
  };

  const handleSaveColumnConfig = async () => {
    if (!configDraft) return;
    setSavingConfig(true);
    try {
      const res = await fetch('/api/translations/admin-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configDraft),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error || 'Failed to save column settings');
        return;
      }
      setTableConfig(data.config);
      setConfigOpen(false);
      setConfigDraft(null);
      setStatusMessage('Column settings saved.');
    } catch {
      setSaveError('Failed to save column settings');
    } finally {
      setSavingConfig(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Languages className="h-7 w-7" />
            Translations
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
            Use the screen tabs (Global, Dashboard, …) to filter keys. Click the pencil icon to edit
            text, then Save — changes go to MongoDB. The public app at{' '}
            <span className="font-medium">localhost:5173</span> loads the same strings from the
            backend API when users switch language.
          </p>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          <Dialog open={manageLangOpen} onOpenChange={setManageLangOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Globe className="h-4 w-4 mr-2" />
                Languages ({locales.length})
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Languages</DialogTitle>
                <DialogDescription>
                  Default language is always first. New languages appear at the bottom. Deleting a
                  language removes it from every translation key.
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[50vh] overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {locales.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                          No languages loaded.
                        </TableCell>
                      </TableRow>
                    ) : (
                      locales.map((loc) => (
                        <TableRow key={loc.code}>
                          <TableCell className="font-mono text-sm">{loc.code}</TableCell>
                          <TableCell>{loc.label}</TableCell>
                          <TableCell className="text-right">
                            {loc.isDefault === true ? (
                              <Badge variant="secondary">Default</Badge>
                            ) : (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  setManageLangOpen(false);
                                  setDeleteLocaleTarget(loc);
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  variant="outline"
                  onClick={() => {
                    setManageLangOpen(false);
                    setLangOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add language
                </Button>
                <Button onClick={() => setManageLangOpen(false)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={openColumnConfig}>
            <Settings2 className="h-4 w-4 mr-2" />
            Columns
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
                  New locale appears in public-circle. Existing keys copy English (US) as a starting
                  value.
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
                <DialogDescription>Example: {TRANSLATION_KEY_EXAMPLES[0]}</DialogDescription>
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

      <div className="flex flex-col gap-4">
        <Tabs value={prefix} onValueChange={handlePrefixChange}>
          <TabsList className="h-auto flex-wrap justify-start gap-1 bg-muted/50 p-1">
            {TRANSLATION_PREFIXES.map((p) => (
              <TabsTrigger key={p.id} value={p.id} className="text-xs sm:text-sm">
                {p.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
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
              setPagination((p) => ({ ...p, page: 1 }));
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any field</SelectItem>
              <SelectItem value="key">Key only</SelectItem>
              <SelectItem value="values">Values only</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>
      </div>

      {statusMessage && (
        <p className="text-sm text-muted-foreground rounded-md border bg-muted/40 px-3 py-2">
          {statusMessage}
        </p>
      )}
      {backendError && (
        <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/10 px-3 py-3">
          <strong>Backend unavailable.</strong> {backendError}
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
        {!loading && pagination.total > 0 && (
          <span className="ml-auto">
            Showing {(pagination.page - 1) * pagination.limit + 1}–
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} key{pagination.total !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <Card className="gap-0 py-0">
        <CardContent className="overflow-x-auto p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">
              No translations for this filter.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {tableConfig.showKeyColumn && (
                    <TableHead className="min-w-[220px]">Key</TableHead>
                  )}
                  {visibleLocaleColumns.map((loc) => (
                    <TableHead key={loc.code} className="min-w-[160px]">
                      {loc.label}
                    </TableHead>
                  ))}
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.key}>
                    {tableConfig.showKeyColumn && (
                      <TableCell className="font-mono text-xs align-top break-all">
                        {row.key}
                      </TableCell>
                    )}
                    {visibleLocaleColumns.map((loc) => (
                      <TableCell key={loc.code} className="text-sm align-top max-w-[240px]">
                        <span className="line-clamp-3 text-muted-foreground">
                          {row.values[loc.code] || '—'}
                        </span>
                      </TableCell>
                    ))}
                    <TableCell className="text-right align-top">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(row)}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setDeleteKeyTarget(row.key)}
                          title="Delete key"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!loading && pagination.total > 0 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.pages}
                <span className="hidden sm:inline">
                  {' '}
                  · {pagination.total} key{pagination.total !== 1 ? 's' : ''} total
                </span>
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
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit translation</DialogTitle>
            <DialogDescription className="font-mono text-xs break-all">
              {editRow?.key}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {locales.map((loc) => (
              <div key={loc.code} className="space-y-1">
                <Label className="text-xs">{loc.label}</Label>
                <Textarea
                  rows={3}
                  value={editValues[loc.code] ?? ''}
                  onChange={(e) =>
                    setEditValues((v) => ({ ...v, [loc.code]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={savingKey === editRow?.key}>
              {savingKey === editRow?.key ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Table columns</DialogTitle>
            <DialogDescription>
              Choose which columns appear in the translations table. Saved to MongoDB for all
              admins.
            </DialogDescription>
          </DialogHeader>
          {configDraft && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="show-key"
                  checked={configDraft.showKeyColumn}
                  onCheckedChange={(checked) =>
                    setConfigDraft((c) =>
                      c ? { ...c, showKeyColumn: checked === true } : c
                    )
                  }
                />
                <Label htmlFor="show-key">Show key column</Label>
              </div>
              <div className="space-y-2 border-t pt-3">
                <p className="text-sm font-medium">Locale value columns</p>
                {locales.map((loc) => (
                  <div key={loc.code} className="flex items-center gap-2">
                    <Checkbox
                      id={`col-${loc.code}`}
                      checked={configDraft.visibleLocales[loc.code] !== false}
                      onCheckedChange={(checked) =>
                        setConfigDraft((c) =>
                          c
                            ? {
                                ...c,
                                visibleLocales: {
                                  ...c.visibleLocales,
                                  [loc.code]: checked === true,
                                },
                              }
                            : c
                        )
                      }
                    />
                    <Label htmlFor={`col-${loc.code}`}>
                      {loc.label} ({loc.code})
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveColumnConfig} disabled={savingConfig}>
              {savingConfig ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteKeyTarget}
        onOpenChange={(open) => !open && !deletingKey && setDeleteKeyTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete translation key?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <p>
                This permanently removes{' '}
                <span className="font-mono text-xs text-foreground">{deleteKeyTarget}</span> in all
                languages.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingKey}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn(buttonVariants({ variant: 'destructive' }))}
              disabled={!!deletingKey}
              onClick={(e) => {
                e.preventDefault();
                void confirmDeleteKey();
              }}
            >
              {deletingKey ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteLocaleTarget}
        onOpenChange={(open) => !open && !deletingLocale && setDeleteLocaleTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete language?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <p>
                This removes{' '}
                <span className="font-medium text-foreground">
                  {deleteLocaleTarget?.label} ({deleteLocaleTarget?.code})
                </span>{' '}
                from the system and strips that locale from every translation key. This cannot be
                undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingLocale}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn(buttonVariants({ variant: 'destructive' }))}
              disabled={deletingLocale}
              onClick={(e) => {
                e.preventDefault();
                void confirmDeleteLocale();
              }}
            >
              {deletingLocale ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                'Delete language'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
