'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, LayoutPanelLeft, Sparkles, Send, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
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
import AdminEmailTemplateEditor from '@/components/templates/AdminEmailTemplateEditor';
import UnsavedChangesDialog from '@/components/templates/UnsavedChangesDialog';

const IMPORTED_DRAFT_STORAGE_KEY = 'admin-template-import-draft';

type Category = {
  _id: string;
  name: string;
  slug: string;
  templateCount?: number;
};

type TemplateRecord = {
  _id: string;
  name: string;
  description: string;
  body: string;
  category?: {
    _id: string;
    name: string;
  };
};

type TemplateEditorPageProps = {
  templateId?: string;
};

type EditorSnapshot = {
  name: string;
  description: string;
  categoryId: string;
  htmlBody: string;
};

export default function TemplateEditorPage({ templateId }: TemplateEditorPageProps) {
  const router = useRouter();
  const isEditMode = Boolean(templateId);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingTemplate, setLoadingTemplate] = useState(isEditMode);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [htmlBody, setHtmlBody] = useState('');
  const [editorInitialHtml, setEditorInitialHtml] = useState('');
  const [editorHtmlEpoch, setEditorHtmlEpoch] = useState(0);

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [initialSnapshot, setInitialSnapshot] = useState<EditorSnapshot | null>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<null | (() => void)>(null);
  const [testEmailDialogOpen, setTestEmailDialogOpen] = useState(false);
  const [testEmailRecipients, setTestEmailRecipients] = useState('');
  const [testEmailSubject, setTestEmailSubject] = useState('');
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [createCategoryDialogOpen, setCreateCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);

  const fetchCategories = async () => {
    try {
      setLoadingCategories(true);
      const res = await fetch('/api/template-categories', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch categories');
      }
      setCategories(Array.isArray(data.categories) ? data.categories : []);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to fetch categories');
    } finally {
      setLoadingCategories(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (!templateId) return;

    let cancelled = false;

    const fetchTemplate = async () => {
      try {
        setLoadingTemplate(true);
        const res = await fetch(`/api/templates/sample/${templateId}`, {
          cache: 'no-store',
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch template');
        }
        const template: TemplateRecord = data.template;
        if (!cancelled) {
          setName(template.name || '');
          setDescription(template.description || '');
          const loadedHtml = template.body || '';
          setHtmlBody(loadedHtml);
          setEditorInitialHtml(loadedHtml);
          setEditorHtmlEpoch((n) => n + 1);
          setCategoryId(template.category?._id || '');
          setInitialSnapshot({
            name: template.name || '',
            description: template.description || '',
            htmlBody: loadedHtml,
            categoryId: template.category?._id || '',
          });
        }
      } catch (error: any) {
        if (!cancelled) {
          setErrorMessage(error.message || 'Failed to fetch template');
        }
      } finally {
        if (!cancelled) {
          setLoadingTemplate(false);
        }
      }
    };

    fetchTemplate();

    return () => {
      cancelled = true;
    };
  }, [templateId]);

  useEffect(() => {
    if (templateId) return;

    try {
      const raw = sessionStorage.getItem(IMPORTED_DRAFT_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as { importedHtml?: unknown };
      const importedHtml =
        typeof parsed.importedHtml === 'string' ? parsed.importedHtml.trim() : '';

      if (importedHtml) {
        setHtmlBody(importedHtml);
        setEditorInitialHtml(importedHtml);
        setEditorHtmlEpoch((n) => n + 1);
        setInitialSnapshot({
          name: '',
          description: '',
          categoryId: '',
          htmlBody: importedHtml,
        });
        return;
      }

      setEditorInitialHtml('');
      setEditorHtmlEpoch((n) => n + 1);
      setInitialSnapshot({
        name: '',
        description: '',
        categoryId: '',
        htmlBody: '',
      });
    } catch {
      // ignore invalid draft payload
      setEditorInitialHtml('');
      setEditorHtmlEpoch((n) => n + 1);
      setInitialSnapshot({
        name: '',
        description: '',
        categoryId: '',
        htmlBody: '',
      });
    }
  }, [templateId]);

  const canSubmit = useMemo(() => {
    return Boolean(name.trim() && categoryId && htmlBody.trim() && !saving);
  }, [name, categoryId, htmlBody, saving]);

  const hasUnsavedChanges = useMemo(() => {
    if (!initialSnapshot) return false;
    return (
      name !== initialSnapshot.name
      || description !== initialSnapshot.description
      || categoryId !== initialSnapshot.categoryId
      || htmlBody !== initialSnapshot.htmlBody
    );
  }, [initialSnapshot, name, description, categoryId, htmlBody]);

  useEffect(() => {
    if (!testEmailSubject.trim() && name.trim()) {
      setTestEmailSubject(`Test email - ${name.trim()}`);
    }
  }, [name, testEmailSubject]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleNavigateAway = (to: string) => {
    if (hasUnsavedChanges) {
      setPendingNavigation(() => () => router.push(to));
      setShowUnsavedDialog(true);
      return;
    }
    router.push(to);
  };

  const handleSubmit = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    if (!name.trim()) {
      setErrorMessage('Template name is required');
      return;
    }
    if (!categoryId) {
      setErrorMessage('Template category is required');
      return;
    }
    if (!htmlBody.trim()) {
      setErrorMessage('Template HTML is required');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        body: htmlBody,
        categoryId,
      };

      const endpoint = isEditMode
        ? `/api/templates/sample/${templateId}`
        : '/api/templates/sample';

      const method = isEditMode ? 'PATCH' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save template');
      }

      setSuccessMessage(
        isEditMode
          ? 'Sample template updated successfully.'
          : 'Sample template created successfully.'
      );

      setInitialSnapshot({
        name: payload.name,
        description: payload.description,
        categoryId: payload.categoryId,
        htmlBody: payload.body,
      });

      if (!isEditMode) {
        const createdId = data?.template?._id;
        if (createdId) {
          try {
            sessionStorage.removeItem(IMPORTED_DRAFT_STORAGE_KEY);
          } catch {
            // ignore
          }
          router.replace(`/dashboard/templates/${createdId}`);
          return;
        }
      }

      router.refresh();
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestEmail = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    if (!htmlBody.trim()) {
      setErrorMessage('Template HTML is required before sending a test email');
      return;
    }

    if (!testEmailRecipients.trim()) {
      setErrorMessage('Recipient email(s) are required');
      return;
    }

    if (!testEmailSubject.trim()) {
      setErrorMessage('Email subject is required');
      return;
    }

    setSendingTestEmail(true);

    try {
      const res = await fetch('/api/templates/sample/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toEmailAddresses: testEmailRecipients,
          emailSubject: testEmailSubject.trim(),
          html: htmlBody,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 207) {
          const sentCount = Number(data.sent || 0);
          const failedList = Array.isArray(data.failed) ? data.failed.join(', ') : '';
          setSuccessMessage(`Sent ${sentCount} test email(s).`);
          setErrorMessage(failedList ? `Failed recipients: ${failedList}` : 'Some recipients failed.');
          setTestEmailDialogOpen(false);
          return;
        }
        throw new Error(data.error || 'Failed to send test email');
      }

      setSuccessMessage(`Sent ${data.sent || 0} test email(s) from ${data.sourceEmailAddress}.`);
      setTestEmailDialogOpen(false);
      setTestEmailRecipients('');
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to send test email');
    } finally {
      setSendingTestEmail(false);
    }
  };

  const getSignedUrl = useCallback(async (params: { fileName: string }) => {
    const response = await fetch('/api/assets/file-upload-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Failed to get upload URL');
    }
    return payload?.data || null;
  }, []);

  const uploadToS3 = useCallback(async (file: File, signedUrl: string) => {
    const fileBinary = await file.arrayBuffer();
    const response = await fetch(signedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: fileBinary,
    });

    return response.ok;
  }, []);

  const getCompanyAsset = useCallback(async (assetId: string) => {
    const response = await fetch(`/api/assets/file-upload/${assetId}`, {
      method: 'PATCH',
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Failed to activate uploaded asset');
    }
    return payload?.data || null;
  }, []);

  const listCompanyAssets = useCallback(async (params?: { limit?: number }) => {
    const response = await fetch('/api/assets/all', { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Failed to fetch assets');
    }

    const all = Array.isArray(payload?.data) ? payload.data : [];
    const mapped = all
      .filter((asset: any) => typeof asset?.url === 'string' && asset.url.trim().length > 0)
      .map((asset: any) => ({
        id:
          typeof asset?._id === 'string'
            ? asset._id
            : typeof asset?.id === 'string'
              ? asset.id
              : undefined,
        name: typeof asset?.name === 'string' ? asset.name : undefined,
        url: String(asset.url).trim(),
        thumbnailUrl: String(asset.url).trim(),
      }));

    const limit = params?.limit;
    return typeof limit === 'number' && limit > 0 ? mapped.slice(0, limit) : mapped;
  }, []);

  const deleteCompanyAsset = useCallback(async (payload: { id?: string; url?: string }) => {
    let assetId = payload?.id;
    if (!assetId && payload?.url) {
      const assets = await listCompanyAssets({ limit: 500 });
      const match = assets.find((asset: any) => asset?.url === payload.url);
      assetId = match?.id;
    }
    if (!assetId) return false;

    const response = await fetch(`/api/assets/file-upload/${assetId}`, {
      method: 'DELETE',
    });
    if (!response.ok) return false;
    return true;
  }, [listCompanyAssets]);

  const uploadImageCallback = useCallback(
    async (file: File, done: (result: { progress: number; url: string }) => void) => {
      try {
        const fileName = file?.name || `image-${Date.now()}`;
        const signedUrlPayload = await getSignedUrl({ fileName });
        if (!signedUrlPayload?.signedUrl || !signedUrlPayload?.assetId) {
          throw new Error('Invalid upload URL response');
        }

        const success = await uploadToS3(file, signedUrlPayload.signedUrl);
        if (!success) {
          throw new Error('Failed to upload image');
        }

        const asset = await getCompanyAsset(String(signedUrlPayload.assetId));
        if (!asset?.url) {
          throw new Error('Uploaded image URL not available');
        }

        done({ progress: 100, url: asset.url });
      } catch (error: any) {
        setErrorMessage(error?.message || 'Failed to upload image');
        done({ progress: 0, url: '' });
      }
    },
    [getSignedUrl, uploadToS3, getCompanyAsset]
  );

  const handleCreateCategory = async () => {
    const trimmedName = newCategoryName.trim();
    if (!trimmedName) {
      setErrorMessage('Category name is required');
      return;
    }

    setCreatingCategory(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/template-categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: trimmedName,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create category');
      }

      await fetchCategories();
      const createdCategoryId = data?.category?._id;
      if (createdCategoryId) {
        setCategoryId(createdCategoryId);
      }
      setSuccessMessage(`Category "${trimmedName}" created successfully.`);
      setCreateCategoryDialogOpen(false);
      setNewCategoryName('');
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to create category');
    } finally {
      setCreatingCategory(false);
    }
  };

  if (loadingTemplate) {
    return (
      <div className="space-y-3">
        <div className="h-11 w-full animate-pulse rounded-lg bg-neutral-200" />
        <div className="grid gap-3 xl:grid-cols-[260px_minmax(0,1fr)]">
          <div className="h-[84vh] animate-pulse rounded-lg bg-neutral-200" />
          <div className="h-[84vh] animate-pulse rounded-lg bg-neutral-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleNavigateAway('/dashboard/templates')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              {isEditMode ? 'Edit Sample Template' : 'Create Sample Template'}
            </h2>
            <p className="text-sm text-muted-foreground">
              Design and maintain shared templates used in Public Circle.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setTestEmailDialogOpen(true)}
            disabled={!htmlBody.trim()}
          >
            <Send className="mr-2 h-4 w-4" />
            Send Test
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : isEditMode ? 'Update Template' : 'Create Template'}
          </Button>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
        <Card className="h-fit shadow-xs xl:sticky xl:top-3">
          <CardHeader className="px-3 pb-2 pt-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <LayoutPanelLeft className="h-4 w-4 text-primary" />
              Template Details
            </CardTitle>
            <CardDescription>
              Configure name, category, and short context for this template.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 px-3 pb-3">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                placeholder="Weekly product spotlight"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="template-category">Template Category</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-auto p-0 text-xs font-medium text-primary hover:bg-transparent hover:text-primary/80"
                  onClick={() => setCreateCategoryDialogOpen(true)}
                >
                  + Create new
                </Button>
              </div>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="template-category">
                  <SelectValue
                    placeholder={
                      loadingCategories
                        ? 'Loading categories...'
                        : 'Select a template category'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category._id} value={category._id}>
                      <span className="flex w-full items-center justify-between gap-4">
                        <span className="truncate">{category.name}</span>
                        <span className="text-xs text-muted-foreground">{category.templateCount || 0}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!loadingCategories && categories.length === 0 && (
                <p className="text-sm text-amber-600">
                  No categories found.
                  {' '}
                  <Link href="/dashboard/template-categories" className="font-medium underline">
                    Create one first
                  </Link>
                  .
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-description">Description</Label>
              <textarea
                id="template-description"
                className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                placeholder="A short summary of this sample template"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              <p className="flex items-center gap-2 font-medium text-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Quality note
              </p>
              <p className="mt-1">
                Keep names clear and descriptions action-oriented so users can quickly pick the right sample.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="overflow-hidden rounded-xl border shadow-xs">
          <AdminEmailTemplateEditor
            initialHtml={editorInitialHtml}
            onChange={setHtmlBody}
            uploadImage={uploadImageCallback}
            listAssets={listCompanyAssets}
            deleteAsset={deleteCompanyAsset}
            className="h-[86vh] min-h-[780px]"
            withFrame={false}
            key={`admin-editor-${templateId || 'new'}-${editorHtmlEpoch}`}
          />
        </div>
      </div>

      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onOpenChange={setShowUnsavedDialog}
        onConfirm={() => {
          const next = pendingNavigation;
          setShowUnsavedDialog(false);
          setPendingNavigation(null);
          if (next) {
            next();
          }
        }}
        onCancel={() => {
          setShowUnsavedDialog(false);
          setPendingNavigation(null);
        }}
      />

      <Dialog open={testEmailDialogOpen} onOpenChange={setTestEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Test Email</DialogTitle>
            <DialogDescription>
              Send this template to one or more recipients. Use comma-separated emails.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="test-email-from">From</Label>
              <Input
                id="test-email-from"
                value="test@publiccircles.com"
                disabled
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="test-email-to">Recipient emails</Label>
              <Input
                id="test-email-to"
                placeholder="john@example.com, jane@example.com"
                value={testEmailRecipients}
                onChange={(event) => setTestEmailRecipients(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="test-email-subject">Subject</Label>
              <Input
                id="test-email-subject"
                placeholder="Test email subject"
                value={testEmailSubject}
                onChange={(event) => setTestEmailSubject(event.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setTestEmailDialogOpen(false)}
              disabled={sendingTestEmail}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSendTestEmail}
              disabled={sendingTestEmail}
            >
              {sendingTestEmail ? 'Sending...' : 'Send Test Email'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={createCategoryDialogOpen}
        onOpenChange={(open) => {
          setCreateCategoryDialogOpen(open);
          if (!open) {
            setNewCategoryName('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Template Category</DialogTitle>
            <DialogDescription>
              Add a new category and use it immediately for this template.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="new-template-category-name">Category Name</Label>
            <Input
              id="new-template-category-name"
              placeholder="e.g. Product Launch"
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !creatingCategory) {
                  event.preventDefault();
                  void handleCreateCategory();
                }
              }}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateCategoryDialogOpen(false)}
              disabled={creatingCategory}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateCategory}
              disabled={creatingCategory || !newCategoryName.trim()}
            >
              {creatingCategory ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Category'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
