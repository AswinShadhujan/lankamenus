/**
 * Normalizes stored ingredient strings (Postgres text[]) into a flat list:
 * splits each entry on commas, trims, drops empties. No DB changes.
 */
export function parseIngredientParts(ingredients: string[] | null | undefined): string[] {
  if (!ingredients?.length) return [];
  const out: string[] = [];
  for (const raw of ingredients) {
    if (raw == null || typeof raw !== 'string') continue;
    for (const part of raw.split(',')) {
      const t = part.trim();
      if (t) out.push(t);
    }
  }
  return out;
}

/** Display line e.g. "Chicken • Cheese • Spices", or null if nothing to show. */
export function formatIngredientsBulletLine(ingredients: string[] | null | undefined): string | null {
  const parts = parseIngredientParts(ingredients);
  if (!parts.length) return null;
  return parts.join(' • ');
}

/** Comma-separated string for edit inputs (cleaned). */
export function formatIngredientsCommaInput(ingredients: string[] | null | undefined): string {
  return parseIngredientParts(ingredients).join(', ');
}

/** Parse admin comma / semicolon / newline input: trim each token, drop empty. */
export function parseIngredientsFromCommaInput(text: string): string[] {
  return text
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
