/**
 * Static keywords for dish-category filter (`GET /dishes?category=`).
 * Single source of truth: match menu item names only — not cuisine tags or restaurant names.
 */
export const DISH_KEYWORDS = {
  Kottu: [
    'kottu',
    'koththu',
    'kothu',
    'kotthu',
    'godamba kottu',
    'roti kottu',
    'cheese kottu',
    'chicken kottu',
    'beef kottu',
    'egg kottu',
    'vegetable kottu',
    'veg kottu',
  ],
  'Rice & Curry': [
    'rice and curry',
    'rice & curry',
    'rice curry',
    'rice packet',
    'rice',
    'bath',
    'soru',
    'meal',
    'meals',
    'lunch packet',
    'mixed rice',
    'white rice',
  ],
  'Lump Rice': ['lump rice', 'lamprais', 'lam prais', 'lamp rice'],
  Biryani: [
    'biryani',
    'biriyani',
    'briyani',
    'biriani',
    'basmati',
    'chicken biryani',
    'mutton biryani',
    'beef biryani',
  ],
  Roti: [
    'roti',
    'godamba',
    'paratha',
    'parata',
    'chapati',
    'pol roti',
    'coconut roti',
  ],
  Devilled: [
    'devilled',
    'deviled',
    'devil',
    'devill',
    'devilled chicken',
    'devilled beef',
    'devilled prawns',
    'devilled pork',
    'devilled squid',
  ],
  'Short Eats': [
    'short eats',
    'short eat',
    'wade',
    'vadai',
    'isso wade',
    'cutlet',
    'patty',
    'rolls',
    'spring roll',
    'samosa',
    'bun',
    'puff',
    'fish roll',
    'egg roll',
  ],
  Pizza: ['pizza', 'pizzas', 'thin crust', 'deep dish'],
  Noodles: [
    'noodles',
    'noodle',
    'fried noodles',
    'chow mein',
    'string hoppers',
    'string hopper',
    'indiappa',
    'idiyappam',
  ],
  Hoppers: [
    'hoppers',
    'hopper',
    'appa',
    'appam',
    'egg hopper',
    'milk hopper',
    'bowl shaped',
    'string hoppers',
  ],
} as const satisfies Record<string, readonly string[]>;

export type DishCategoryKey = keyof typeof DISH_KEYWORDS;

export function isDishCategoryKey(q: string): q is DishCategoryKey {
  return Object.prototype.hasOwnProperty.call(DISH_KEYWORDS, q);
}

/** Keywords for `DISH_KEYWORDS[category] ?? [category]` (deduped, trimmed). */
export function resolveDishCategoryKeywords(category: string): string[] {
  const trimmed = category.trim();
  if (!trimmed) return [];
  const terms = Object.prototype.hasOwnProperty.call(DISH_KEYWORDS, trimmed)
    ? [...DISH_KEYWORDS[trimmed as keyof typeof DISH_KEYWORDS]]
    : [trimmed];
  return [...new Set(terms.map((s) => String(s).trim()).filter(Boolean))];
}
