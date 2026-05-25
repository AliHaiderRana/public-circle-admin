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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Info, Pencil } from 'lucide-react';
import {
  DEFAULT_UI_TERMS,
  TERM_DISPLAY_NAMES,
  UI_TERM_KEYS,
  type UiTermRow,
} from '@/lib/ui-term-constants';

type LocaleOption = { code: string; label: string };

export default function UiHintsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [terms, setTerms] = useState<UiTermRow[]>([]);
  const [locales, setLocales] = useState<LocaleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editTerm, setEditTerm] = useState<UiTermRow | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editDescriptions, setEditDescriptions] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const termsFromDefaults = (): UiTermRow[] =>
    UI_TERM_KEYS.map((key) => ({
      key,
      label: DEFAULT_UI_TERMS[key]?.label ?? TERM_DISPLAY_NAMES[key] ?? key,
      descriptions: { ...(DEFAULT_UI_TERMS[key]?.descriptions ?? {}) },
    }));

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
      if (!termsRes.ok) {
        setTerms(termsFromDefaults());
        setError(termsData.error || 'Failed to load from database — check MONGODB_URI in admin .env');
      } else {
        const list = (termsData.terms ?? []) as UiTermRow[];
        const ordered = UI_TERM_KEYS.map(
          (key) =>
            list.find((t) => t.key === key) ?? {
              key,
              label: DEFAULT_UI_TERMS[key]?.label ?? TERM_DISPLAY_NAMES[key] ?? key,
              descriptions: { ...(DEFAULT_UI_TERMS[key]?.descriptions ?? {}) },
            }
        );
        setTerms(ordered.length ? ordered : termsFromDefaults());
      }
      setLocales(
        (localesData.locales ?? []).map((l: LocaleOption) => ({
          code: l.code,
          label: l.label,
        }))
      );
    } catch {
      setTerms(termsFromDefaults());
      setError('Cannot reach database — showing sample text. Check MONGODB_URI, then click Seed defaults.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const openEdit = (term: UiTermRow) => {
    setEditTerm(term);
    setEditLabel(term.label);
    const desc: Record<string, string> = {};
    for (const loc of locales) {
      desc[loc.code] = term.descriptions[loc.code] ?? '';
    }
    setEditDescriptions(desc);
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
          label: editLabel,
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
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    setError(null);
    try {
      const res = await fetch('/api/ui-terms/seed', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError([data.error, data.hint].filter(Boolean).join(' — '));
        return;
      }
      setError(null);
      await load();
    } finally {
      setSeeding(false);
    }
  };

  const preview = (term: UiTermRow) => {
    const en = term.descriptions['en-US'] || Object.values(term.descriptions)[0];
    return en?.length > 80 ? `${en.slice(0, 80)}…` : en || '—';
  };

  if (authLoading || !user) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Info className="h-7 w-7" />
            Context help
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Tooltip text shown next to key concepts in public-circle (Fields, Segments, etc.). Each
            locale has its own description; stored in MongoDB.
          </p>
        </div>
        <Button variant="outline" onClick={handleSeed} disabled={seeding}>
          {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Seed defaults'}
        </Button>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Help topics</CardTitle>
          <CardDescription>
            Public-circle shows an info icon beside these labels; hover to read the tooltip.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Topic</TableHead>
                  <TableHead>Admin label</TableHead>
                  <TableHead>Preview (EN-US)</TableHead>
                  <TableHead className="w-[80px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {terms.map((term) => (
                  <TableRow key={term.key}>
                    <TableCell className="font-medium">
                      {TERM_DISPLAY_NAMES[term.key] || term.key}
                    </TableCell>
                    <TableCell>{term.label}</TableCell>
                    <TableCell className="max-w-md text-sm text-muted-foreground">
                      {preview(term)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(term)} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit context help</DialogTitle>
            <DialogDescription>
              {editTerm ? TERM_DISPLAY_NAMES[editTerm.key] || editTerm.key : ''} — key:{' '}
              <code className="text-xs">{editTerm?.key}</code>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Display label (reference)</Label>
              <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
            </div>
            {locales.map((loc) => (
              <div key={loc.code} className="space-y-1">
                <Label className="text-xs">{loc.label} — tooltip</Label>
                <Textarea
                  rows={3}
                  value={editDescriptions[loc.code] ?? ''}
                  onChange={(e) =>
                    setEditDescriptions((d) => ({ ...d, [loc.code]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
