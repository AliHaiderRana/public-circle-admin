'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Pencil, Loader2, X } from 'lucide-react';

interface ChangelogEntry {
  _id: string;
  version: string;
  date: string;
  features: string[];
  fixes: string[];
  improvements: string[];
  isPublished: boolean;
}

const emptyForm = {
  version: '',
  date: new Date().toISOString().split('T')[0],
  features: '',
  fixes: '',
  improvements: '',
  isPublished: true,
};

export default function ChangelogPage() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<ChangelogEntry | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/changelog');
    const json = await res.json();
    setEntries(json.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const openCreate = () => {
    setEditEntry(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (entry: ChangelogEntry) => {
    setEditEntry(entry);
    setForm({
      version: entry.version,
      date: entry.date,
      features: entry.features.join('\n'),
      fixes: entry.fixes.join('\n'),
      improvements: entry.improvements.join('\n'),
      isPublished: entry.isPublished,
    });
    setDialogOpen(true);
  };

  const parseLines = (text: string) =>
    text.split('\n').map(l => l.trim()).filter(Boolean);

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      version: form.version.trim(),
      date: form.date,
      features: parseLines(form.features),
      fixes: parseLines(form.fixes),
      improvements: parseLines(form.improvements),
      isPublished: form.isPublished,
    };

    const url = editEntry ? `/api/changelog/${editEntry._id}` : '/api/changelog';
    const method = editEntry ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setDialogOpen(false);
      fetchEntries();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this changelog entry?')) return;
    setDeletingId(id);
    await fetch(`/api/changelog/${id}`, { method: 'DELETE' });
    setDeletingId(null);
    fetchEntries();
  };

  const togglePublish = async (entry: ChangelogEntry) => {
    await fetch(`/api/changelog/${entry._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublished: !entry.isPublished }),
    });
    fetchEntries();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Changelog</h1>
          <p className="text-sm text-muted-foreground">Manage what users see in the What's New page</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Version
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : entries.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No changelog entries yet.</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <Card key={entry._id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base font-mono">v{entry.version}</CardTitle>
                    <Badge variant={entry.isPublished ? 'default' : 'secondary'}>
                      {entry.isPublished ? 'Published' : 'Draft'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{entry.date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={entry.isPublished}
                      onCheckedChange={() => togglePublish(entry)}
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(entry)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(entry._id)}
                      disabled={deletingId === entry._id}
                    >
                      {deletingId === entry._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {entry.features.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Features</p>
                    <ul className="space-y-1">{entry.features.map((f, i) => <li key={i} className="text-sm text-muted-foreground">• {f}</li>)}</ul>
                  </div>
                )}
                {entry.fixes.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Bug Fixes</p>
                    <ul className="space-y-1">{entry.fixes.map((f, i) => <li key={i} className="text-sm text-muted-foreground">• {f}</li>)}</ul>
                  </div>
                )}
                {entry.improvements.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Improvements</p>
                    <ul className="space-y-1">{entry.improvements.map((f, i) => <li key={i} className="text-sm text-muted-foreground">• {f}</li>)}</ul>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editEntry ? 'Edit Version' : 'Add Version'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Version</Label>
                <Input placeholder="1.2.0" value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Features <span className="text-muted-foreground font-normal">(one per line)</span></Label>
              <Textarea rows={3} placeholder="New feature description" value={form.features} onChange={e => setForm(f => ({ ...f, features: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Bug Fixes <span className="text-muted-foreground font-normal">(one per line)</span></Label>
              <Textarea rows={3} placeholder="Bug fix description" value={form.fixes} onChange={e => setForm(f => ({ ...f, fixes: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Improvements <span className="text-muted-foreground font-normal">(one per line)</span></Label>
              <Textarea rows={2} placeholder="Improvement description" value={form.improvements} onChange={e => setForm(f => ({ ...f, improvements: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.isPublished} onCheckedChange={v => setForm(f => ({ ...f, isPublished: v }))} />
              <Label>Published (visible to users)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.version || !form.date}>
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
