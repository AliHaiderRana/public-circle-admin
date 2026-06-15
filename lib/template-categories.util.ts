type CategoryRef = string | { _id?: string } | null | undefined;

type TemplateWithCategories = {
  category?: CategoryRef;
  categories?: CategoryRef[];
};

export function getTemplateCategoryIds(template: TemplateWithCategories): string[] {
  const ids = new Set<string>();

  if (Array.isArray(template.categories)) {
    for (const category of template.categories) {
      const id = typeof category === 'string' ? category : category?._id;
      if (id) ids.add(String(id));
    }
  }

  if (template.category) {
    const id =
      typeof template.category === 'string'
        ? template.category
        : template.category?._id;
    if (id) ids.add(String(id));
  }

  return Array.from(ids);
}

export function getTemplateCategoryNames(template: TemplateWithCategories): string[] {
  const names = new Set<string>();

  if (Array.isArray(template.categories)) {
    for (const category of template.categories) {
      if (typeof category === 'object' && category?.name) {
        names.add(category.name);
      }
    }
  }

  if (
    template.category &&
    typeof template.category === 'object' &&
    template.category.name
  ) {
    names.add(template.category.name);
  }

  return Array.from(names);
}

export function templateMatchesCategories(
  template: TemplateWithCategories,
  selectedCategoryIds: string[],
): boolean {
  if (selectedCategoryIds.length === 0) return true;

  const templateCategoryIds = getTemplateCategoryIds(template);
  return selectedCategoryIds.some((id) => templateCategoryIds.includes(id));
}

export function resolveCategoryIds(payload: {
  categoryIds?: string[];
  categoryId?: string;
}): string[] {
  if (Array.isArray(payload.categoryIds) && payload.categoryIds.length > 0) {
    return payload.categoryIds;
  }

  if (payload.categoryId) {
    return [payload.categoryId];
  }

  return [];
}
