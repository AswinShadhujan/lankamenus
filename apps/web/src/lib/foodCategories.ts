import {
  FOOD_CATEGORIES,
  FOOD_CATEGORY_SET,
} from '@/constants/foodCategories';

/**
 * Trim, dedupe, keep only allowed FOOD_CATEGORIES, stable order = FOOD_CATEGORIES order.
 */
export function normalizeRestaurantCategories(input: Iterable<string> | null | undefined): string[] {
  if (input == null) return [];
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const raw of input) {
    const t = typeof raw === 'string' ? raw.trim() : '';
    if (!t || !FOOD_CATEGORY_SET.has(t) || seen.has(t)) continue;
    seen.add(t);
    ordered.push(t);
  }
  return FOOD_CATEGORIES.filter((c) => seen.has(c));
}

/** Parse comma-separated URL param into normalized category list. */
export function parseCategoriesQueryParam(param: string | null | undefined): string[] {
  if (param == null || param === '') return [];
  const parts = param.split(',').map((s) => s.trim()).filter(Boolean);
  return normalizeRestaurantCategories(parts);
}

/** Serialize selected categories for `categories` query (comma-separated, no encoding needed for our labels). */
export function serializeCategoriesQuery(categories: string[]): string {
  return normalizeRestaurantCategories(categories).join(',');
}
