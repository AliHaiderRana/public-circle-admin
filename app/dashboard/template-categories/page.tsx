'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, FolderTree, Pencil, Trash2, ArrowLeft, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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

type TemplateCategory = {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  isPopular?: boolean;
  templateCount: number;
};

export default function TemplateCategoriesPage() {
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newIsPopular, setNewIsPopular] = useState(false);
  const [creating, setCreating] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIsPopular, setEditIsPopular] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<TemplateCategory | null>(null);

  const loadCategories = async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/template-categories', { cache: 'no-store' });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to fetch categories');
      }
      setCategories(Array.isArray(payload.categories) ? payload.categories : []);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const resetEdit = () => {
    setEditId(null);
    setEditName('');
    setEditDescription('');
    setEditIsPopular(false);
  };

  const handleCreate = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    if (!newName.trim()) {
      setErrorMessage('Category name is required.');
      return;
    }

    setCreating(true);

    try {
      const res = await fetch('/api/template-categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim(),
          isPopular: newIsPopular,
        }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to create category');
      }

      setSuccessMessage('Category created successfully.');
      setNewName('');
      setNewDescription('');
      setNewIsPopular(false);
      await loadCategories();
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to create category');
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (category: TemplateCategory) => {
    setEditId(category._id);
    setEditName(category.name || '');
    setEditDescription(category.description || '');
    setEditIsPopular(Boolean(category.isPopular));
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleSaveEdit = async () => {
    if (!editId) return;

    setErrorMessage('');
    setSuccessMessage('');

    if (!editName.trim()) {
      setErrorMessage('Category name is required.');
      return;
    }

    setSavingEdit(true);

    try {
      const res = await fetch(`/api/template-categories/${editId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim(),
          isPopular: editIsPopular,
        }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to update category');
      }

      setSuccessMessage('Category updated successfully.');
      resetEdit();
      await loadCategories();
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to update category');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (category: TemplateCategory) => {
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await fetch(`/api/template-categories/${category._id}`, {
        method: 'DELETE',
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to delete category');
      }

      setSuccessMessage('Category deleted successfully.');
      setCategoryToDelete(null);
      await loadCategories();
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to delete category');
    }
  };

  const linkedTemplateCount = categories.reduce(
    (total, category) => total + (category.templateCount || 0),
    0
  );

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-3xl font-semibold tracking-tight">Template Categories</h2>
            <p className="text-sm text-muted-foreground">
              Group sample templates by purpose and keep library navigation clean.
            </p>
          </div>

          <Button asChild variant="outline" className="bg-background">
            <Link href="/dashboard/templates">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Templates
            </Link>
          </Button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Card className="border-dashed">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Active Categories</p>
              <p className="mt-1 text-lg font-semibold">{categories.length}</p>
            </CardContent>
          </Card>
          <Card className="border-dashed">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Linked Templates</p>
              <p className="mt-1 text-lg font-semibold">{linkedTemplateCount}</p>
            </CardContent>
          </Card>
          <Card className="border-dashed">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Popular Categories</p>
              <p className="mt-1 text-lg font-semibold">
                {categories.filter((category) => Boolean(category.isPopular)).length}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-4 lg:sticky lg:top-6 lg:h-fit">
          <CardHeader>
            <CardTitle>Create Category</CardTitle>
            <CardDescription>
              New categories appear immediately in sample template forms.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">Name</Label>
              <Input
                id="category-name"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="Newsletter"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category-description">Description</Label>
              <Input
                id="category-description"
                value={newDescription}
                onChange={(event) => setNewDescription(event.target.value)}
                placeholder="Templates used for regular newsletters"
              />
            </div>

            <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
              <Label htmlFor="category-popular" className="text-sm">Mark as popular</Label>
              <Switch id="category-popular" checked={newIsPopular} onCheckedChange={setNewIsPopular} />
            </div>

            <Button onClick={handleCreate} disabled={creating} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              {creating ? 'Creating...' : 'Create Category'}
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-8">
          <CardHeader>
            <CardTitle>Existing Categories</CardTitle>
            <CardDescription>
              Categories with linked templates cannot be deleted until templates are moved or archived.
            </CardDescription>
          </CardHeader>
          <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, idx) => (
                <Card key={idx}>
                  <CardContent className="space-y-2 p-4">
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="h-4 w-2/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : categories.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/20 p-10 text-center text-muted-foreground">
              <FolderTree className="mx-auto mb-2 h-6 w-6" />
              No categories created yet.
            </div>
          ) : (
            <div className="space-y-3">
              {categories.map((category) => {
                const isEditing = editId === category._id;

                return (
                  <article
                    key={category._id}
                    className="rounded-lg border bg-card p-4 shadow-xs"
                  >
                    {isEditing ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        <Input
                          value={editName}
                          onChange={(event) => setEditName(event.target.value)}
                          placeholder="Category name"
                        />
                        <Input
                          value={editDescription}
                          onChange={(event) => setEditDescription(event.target.value)}
                          placeholder="Category description"
                        />
                        <div className="flex items-center gap-3 md:col-span-2">
                          <Switch
                            checked={editIsPopular}
                            onCheckedChange={setEditIsPopular}
                          />
                          <Label>Popular category</Label>
                        </div>
                        <div className="flex items-center gap-2 md:col-span-2">
                          <Button onClick={handleSaveEdit} disabled={savingEdit}>
                            {savingEdit ? 'Saving...' : 'Save Changes'}
                          </Button>
                          <Button variant="outline" onClick={resetEdit}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-base font-semibold">{category.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {category.description || 'No description'}
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{category.templateCount} linked templates</Badge>
                            {category.isPopular && (
                              <Badge variant="outline">
                                <Star className="mr-1 h-3 w-3" />
                                Popular
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => startEdit(category)}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setCategoryToDelete(category)}
                            disabled={category.templateCount > 0}
                            title={
                              category.templateCount > 0
                                ? 'Cannot delete while templates are linked'
                                : 'Delete category'
                            }
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog
        open={Boolean(categoryToDelete)}
        onOpenChange={(open) => !open && setCategoryToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template category?</AlertDialogTitle>
            <AlertDialogDescription>
              {categoryToDelete
                ? `This will soft delete ${categoryToDelete.name}. Categories with linked templates cannot be deleted.`
                : 'This action archives the selected category.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={() => categoryToDelete && handleDelete(categoryToDelete)}
            >
              Delete Category
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
