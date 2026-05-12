'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
  FolderTree,
  Image as ImageIcon,
  Sparkles,
  FileCode2,
  Upload,
  Eye,
  Loader2,
  X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import { cn } from '@/lib/utils';
import AdminEmailTemplateEditor from '@/components/templates/AdminEmailTemplateEditor';

type TemplateCategory = {
  _id: string;
  name: string;
  slug: string;
  templateCount: number;
};

type TemplateRecord = {
  _id: string;
  name: string;
  description?: string;
  thumbnailURL: string;
  updatedAt: string;
  status: 'ACTIVE' | 'ARCHIVED';
  category?: {
    _id: string;
    name: string;
  };
};

const IMPORTED_DRAFT_STORAGE_KEY = 'admin-template-import-draft';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'ARCHIVED' | 'ALL'>('ACTIVE');
  const [errorMessage, setErrorMessage] = useState('');
  const [templateToArchive, setTemplateToArchive] = useState<TemplateRecord | null>(null);
  const [templateToUnarchive, setTemplateToUnarchive] = useState<TemplateRecord | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<TemplateRecord | null>(null);
  const [openImportDialog, setOpenImportDialog] = useState(false);
  const [importMethod, setImportMethod] = useState<'file' | 'paste'>('file');
  const [htmlContent, setHtmlContent] = useState('');
  const [validationError, setValidationError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    templateId: string;
    type: 'archive' | 'unarchive' | 'delete';
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadAll = async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const [templatesRes, categoriesRes] = await Promise.all([
        fetch(`/api/templates/sample?status=${statusFilter}`, {
          cache: 'no-store',
        }),
        fetch('/api/template-categories', { cache: 'no-store' }),
      ]);

      const templatesPayload = await templatesRes.json();
      const categoriesPayload = await categoriesRes.json();

      if (!templatesRes.ok) {
        throw new Error(templatesPayload.error || 'Failed to fetch templates');
      }
      if (!categoriesRes.ok) {
        throw new Error(categoriesPayload.error || 'Failed to fetch categories');
      }

      setTemplates(Array.isArray(templatesPayload.templates) ? templatesPayload.templates : []);
      setCategories(Array.isArray(categoriesPayload.categories) ? categoriesPayload.categories : []);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const id = setTimeout(() => {
      loadAll();
    }, 300);

    return () => clearTimeout(id);
  }, [statusFilter]);

  const filteredTemplates = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return templates.filter((template) => {
      const matchesSearch =
        !searchValue
        || template.name?.toLowerCase().includes(searchValue)
        || template.description?.toLowerCase().includes(searchValue);

      const templateCategoryId = template.category?._id || '';
      const matchesCategory =
        selectedCategories.length === 0
        || (templateCategoryId && selectedCategories.includes(templateCategoryId));

      return matchesSearch && matchesCategory;
    });
  }, [templates, search, selectedCategories]);

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) => (
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    ));
  };

  const handleArchive = async (template: TemplateRecord) => {
    setPendingAction({ templateId: template._id, type: 'archive' });
    try {
      const res = await fetch(`/api/templates/sample/${template._id}/archive`, {
        method: 'PATCH',
      });
      const payload = await res.json();

      if (!res.ok) {
        throw new Error(payload.error || 'Failed to archive template');
      }

      await loadAll();
      setTemplateToArchive(null);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to archive template');
    } finally {
      setPendingAction(null);
    }
  };

  const handleDelete = async (template: TemplateRecord) => {
    setPendingAction({ templateId: template._id, type: 'delete' });
    try {
      const res = await fetch(`/api/templates/sample/${template._id}`, {
        method: 'DELETE',
      });
      const payload = await res.json();

      if (!res.ok) {
        throw new Error(payload.error || 'Failed to delete template');
      }

      await loadAll();
      setTemplateToDelete(null);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to delete template');
    } finally {
      setPendingAction(null);
    }
  };

  const handleUnarchive = async (template: TemplateRecord) => {
    setPendingAction({ templateId: template._id, type: 'unarchive' });
    try {
      const res = await fetch(`/api/templates/sample/${template._id}/unarchive`, {
        method: 'PATCH',
      });
      const payload = await res.json();

      if (!res.ok) {
        throw new Error(payload.error || 'Failed to unarchive template');
      }

      await loadAll();
      setTemplateToUnarchive(null);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to unarchive template');
    } finally {
      setPendingAction(null);
    }
  };

  const resetImportState = () => {
    setImportMethod('file');
    setHtmlContent('');
    setValidationError('');
    setIsImporting(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const closeImportDialog = () => {
    setOpenImportDialog(false);
    resetImportState();
  };

  const validateHtml = (html: string): string | null => {
    if (!html.trim()) return 'Please provide HTML content to import.';
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      if (doc.querySelector('parsererror')) {
        return 'Invalid HTML detected. Please fix syntax and retry.';
      }
      return null;
    } catch {
      return 'Invalid HTML detected. Please fix syntax and retry.';
    }
  };

  const handleStartFromScratch = () => {
    try {
      sessionStorage.removeItem(IMPORTED_DRAFT_STORAGE_KEY);
    } catch {
      // ignore
    }
    window.location.href = '/dashboard/templates/new';
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.html')) {
      setValidationError('Please upload an .html file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || '');
      setHtmlContent(value);
      setValidationError('');
    };
    reader.onerror = () => {
      setValidationError('Could not read this file. Try another HTML file.');
    };
    reader.readAsText(file);
  };

  const handleImportHtml = () => {
    const error = validateHtml(htmlContent);
    if (error) {
      setValidationError(error);
      return;
    }

    setIsImporting(true);
    try {
      sessionStorage.setItem(
        IMPORTED_DRAFT_STORAGE_KEY,
        JSON.stringify({
          importedHtml: htmlContent,
          source: importMethod === 'paste' ? 'HTML_CODE_IMPORT' : 'HTML_FILE_IMPORT',
        })
      );
      window.location.href = '/dashboard/templates/new';
    } finally {
      setIsImporting(false);
    }
  };

  const handlePreviewTemplate = async (templateId: string) => {
    setPreviewTemplateId(templateId);
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewHtml('');

    try {
      const res = await fetch(`/api/templates/sample/${templateId}?includeArchived=true`, {
        cache: 'no-store',
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to load template preview');
      }

      const html = typeof payload?.template?.body === 'string' ? payload.template.body : '';
      setPreviewHtml(html);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to load template preview');
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardContent className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold sm:text-3xl">Create Template</h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Choose from existing templates, start from scratch, or import HTML.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="icon" className="h-10 w-10">
              <Link href="/dashboard/template-categories" aria-label="Manage Categories" title="Manage categories">
                <FolderTree className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card
          className="cursor-pointer overflow-hidden transition-colors hover:bg-muted/40"
          onClick={handleStartFromScratch}
        >
          <div className="h-44 w-full bg-muted/40 px-6 py-8">
            <div className="flex h-full items-center justify-center">
              <Sparkles className="h-16 w-16 text-primary/80" strokeWidth={1.5} />
            </div>
          </div>
          <CardContent className="space-y-1.5 px-6 pb-6 pt-4">
            <h3 className="text-lg font-semibold">Start from Scratch</h3>
            <p className="text-sm text-muted-foreground">
              Create a new sample template with the visual builder.
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer overflow-hidden transition-colors hover:bg-muted/40"
          onClick={() => setOpenImportDialog(true)}
        >
          <div className="h-44 w-full bg-muted/40 px-6 py-8">
            <div className="flex h-full items-center justify-center">
              <FileCode2 className="h-16 w-16 text-primary/80" strokeWidth={1.5} />
            </div>
          </div>
          <CardContent className="space-y-1.5 px-6 pb-6 pt-4">
            <h3 className="text-lg font-semibold">Import HTML / Paste Code</h3>
            <p className="text-sm text-muted-foreground">
              Bring your own HTML template to get started quickly.
            </p>
          </CardContent>
        </Card>
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="shrink-0 lg:w-72">
          <Card className="sticky top-4 rounded-xl border bg-card">
            <CardContent className="space-y-4 p-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Categories</p>
                <p className="mt-1 text-sm text-muted-foreground">Filter templates by topics you care about</p>
              </div>

              <div className="max-h-[60vh] space-y-2 overflow-y-auto">
                {categories.map((category) => (
                  <label
                    key={category._id}
                    htmlFor={`template-category-${category._id}`}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm transition hover:bg-muted"
                  >
                    <Checkbox
                      id={`template-category-${category._id}`}
                      checked={selectedCategories.includes(category._id)}
                      onCheckedChange={() => toggleCategory(category._id)}
                    />
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="truncate font-medium">{category.name}</span>
                      <span className="text-xs text-muted-foreground">({category.templateCount || 0})</span>
                    </div>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        </aside>

        <section className="flex-1 space-y-4">
          <div>
            <h3 className="text-2xl font-semibold">Sample Templates</h3>
            <p className="text-sm text-muted-foreground">Use a ready-made design to jump-start your email.</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_220px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-12 pl-10"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search templates..."
              />
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'ACTIVE' | 'ARCHIVED' | 'ALL')}>
              <SelectTrigger className="h-12 rounded-xl bg-white">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active Templates</SelectItem>
                <SelectItem value="ARCHIVED">Archived Templates</SelectItem>
                <SelectItem value="ALL">All Templates</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <Card key={idx}>
                  <CardContent className="space-y-3 p-4">
                    <Skeleton className="aspect-[4/3] w-full rounded-md" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/20 p-12 text-center">
              <p className="text-lg font-medium">No sample templates found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {search.trim() || selectedCategories.length > 0
                  ? 'No templates match your filters. Try adjusting your search or categories.'
                  : 'Create your first sample template to populate the library.'}
              </p>
              <Button asChild className="mt-4">
                <Link href="#" onClick={(event) => {
                  event.preventDefault();
                  handleStartFromScratch();
                }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Sample Template
                </Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredTemplates.map((template) => {
                  const isArchiving = pendingAction?.templateId === template._id && pendingAction.type === 'archive';
                  const isUnarchiving = pendingAction?.templateId === template._id && pendingAction.type === 'unarchive';
                  const isDeleting = pendingAction?.templateId === template._id && pendingAction.type === 'delete';
                  const isActionPending = isArchiving || isUnarchiving || isDeleting;

                  return (
                <Card
                  key={template._id}
                  className="group relative flex h-full overflow-hidden"
                >
                  <CardContent className="flex min-h-[360px] w-full flex-col gap-3 p-4">
                    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md border bg-muted/40">
                      {template.thumbnailURL ? (
                        <img
                          src={template.thumbnailURL}
                          alt={template.name}
                          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                          <ImageIcon className="mr-2 h-4 w-4" />
                          No thumbnail available
                        </div>
                      )}

                      <button
                        type="button"
                        className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => handlePreviewTemplate(template._id)}
                        title="Preview template"
                      >
                        <div className="text-center text-white">
                          <Eye className="mx-auto h-7 w-7" />
                          <span className="mt-1 block text-sm font-medium">Preview</span>
                        </div>
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <h3 className="line-clamp-2 min-h-[3.5rem] text-center text-lg font-semibold tracking-tight">{template.name}</h3>
                      <p className="line-clamp-2 min-h-10 text-center text-sm text-muted-foreground">
                        {template.description || 'No description'}
                      </p>
                    </div>

                    <div className="flex min-h-6 items-center justify-between gap-2">
                      <Badge variant="secondary" className="truncate">
                        {template.category?.name || 'Uncategorized'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Updated {new Date(template.updatedAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className={cn('mt-auto grid grid-cols-[1fr_auto_auto_auto] items-center gap-2')}>
                      {template.status === 'ACTIVE' ? (
                        <Button asChild variant="secondary" size="sm">
                          <Link href={`/dashboard/templates/${template._id}`} title="Edit template">
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit Template
                          </Link>
                        </Button>
                      ) : (
                        <Button variant="secondary" size="sm" disabled>
                          Archived
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handlePreviewTemplate(template._id)}
                        title="Preview template"
                        disabled={isActionPending}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>

                      {template.status === 'ACTIVE' ? (
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="Archive template"
                          title="Archive template"
                          onClick={() => setTemplateToArchive(template)}
                          disabled={isActionPending}
                        >
                          {isArchiving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Archive className="h-4 w-4" />
                          )}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="Unarchive template"
                          title="Unarchive template"
                          onClick={() => setTemplateToUnarchive(template)}
                          disabled={isActionPending}
                        >
                          {isUnarchiving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ArchiveRestore className="h-4 w-4" />
                          )}
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Delete template permanently"
                        title="Delete template permanently"
                        onClick={() => setTemplateToDelete(template)}
                        disabled={isActionPending}
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin text-destructive" />
                        ) : (
                          <Trash2 className="h-4 w-4 text-destructive" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                  );
                })}
            </div>
          )}
        </section>
      </div>

      <Dialog
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) {
            setPreviewTemplateId(null);
            setPreviewHtml('');
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="z-50 flex h-[100dvh] w-screen max-w-[100vw] translate-x-[-50%] translate-y-[-50%] flex-col gap-0 overflow-hidden rounded-none border-0 bg-background p-0 shadow-2xl sm:h-[100dvh] sm:w-screen sm:max-w-[100vw]"
        >
          <DialogHeader className="shrink-0 border-b px-4 py-3 text-left sm:px-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <DialogTitle>Template Preview</DialogTitle>
                <DialogDescription>
                  Preview using the same builder preview mode used in Public Circle.
                </DialogDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => setPreviewOpen(false)}
                aria-label="Close preview"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="flex flex-1 min-h-0 overflow-hidden bg-muted/30">
            {previewLoading ? (
              <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : !previewTemplateId || !previewHtml.trim() ? (
              <div className="flex h-full w-full items-center justify-center px-6 text-center">
                <p className="text-sm text-muted-foreground">No template content available for preview.</p>
              </div>
            ) : (
              <div className="h-full w-full">
                <AdminEmailTemplateEditor
                  initialHtml={previewHtml}
                  previewOnly
                  enabled
                  withFrame={false}
                  className="h-full min-h-0"
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(templateToArchive)} onOpenChange={(open) => !open && setTemplateToArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive sample template?</AlertDialogTitle>
            <AlertDialogDescription>
              {templateToArchive
                ? `"${templateToArchive.name}" will be archived and hidden from active template listings. You can keep it for record/history.`
                : 'This will archive the selected template.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => templateToArchive && handleArchive(templateToArchive)}>
              Archive Template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(templateToUnarchive)} onOpenChange={(open) => !open && setTemplateToUnarchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unarchive sample template?</AlertDialogTitle>
            <AlertDialogDescription>
              {templateToUnarchive
                ? `"${templateToUnarchive.name}" will be moved back to active templates and will be available again.`
                : 'This will move the selected template back to active status.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => templateToUnarchive && handleUnarchive(templateToUnarchive)}>
              Unarchive Template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(templateToDelete)} onOpenChange={(open) => !open && setTemplateToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete sample template permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              {templateToDelete
                ? `This will permanently remove "${templateToDelete.name}" from the database. This action cannot be undone.`
                : 'This will permanently delete the selected template from the database and cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => templateToDelete && handleDelete(templateToDelete)}>
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={openImportDialog} onOpenChange={(open) => !open && closeImportDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import HTML Template</DialogTitle>
            <DialogDescription>
              Upload an HTML file or paste raw HTML code to start editing immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={importMethod === 'file' ? 'default' : 'outline'}
                onClick={() => {
                  setImportMethod('file');
                  setValidationError('');
                }}
              >
                Upload File
              </Button>
              <Button
                type="button"
                variant={importMethod === 'paste' ? 'default' : 'outline'}
                onClick={() => {
                  setImportMethod('paste');
                  setValidationError('');
                }}
              >
                Paste Code
              </Button>
            </div>

            {importMethod === 'file' ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">HTML file</label>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground hover:bg-muted/40">
                  <Upload className="h-4 w-4" />
                  Choose .html file
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".html,text/html"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium">HTML code</label>
                <textarea
                  className="min-h-44 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  placeholder="Paste full HTML here"
                  value={htmlContent}
                  onChange={(event) => {
                    setHtmlContent(event.target.value);
                    if (validationError) setValidationError('');
                  }}
                />
              </div>
            )}

            {validationError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {validationError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeImportDialog}>
              Cancel
            </Button>
            <Button type="button" onClick={handleImportHtml} disabled={isImporting}>
              {isImporting ? 'Importing...' : 'Continue to Editor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
