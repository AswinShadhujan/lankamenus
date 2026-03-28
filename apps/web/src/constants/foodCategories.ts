/** Unified restaurant-level food categories (PickMe / Uber Eats style). Stored in API as `cuisine_tags`. */
export const FOOD_CATEGORIES = [
  'Sri Lankan',
  'Indian',
  'Chinese',
  'Kottu',
  'Biryani',
  'Rice & Curry',
  'Fast Food',
  'Burgers',
  'Pizza',
  'Cafe',
  'Dessert',
  'Asian',
] as const;

export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

export const FOOD_CATEGORY_SET = new Set<string>(FOOD_CATEGORIES);
