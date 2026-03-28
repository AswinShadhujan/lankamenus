/**
 * How GET /restaurants orders rows before pagination / in-memory tie-breakers.
 * Extend with personalization (user segment, geo boost) without changing API names.
 */
export type RestaurantSortMode =
  | 'default_relevance'
  | 'default_created'
  | 'distance'
  | 'top_rated'
  | 'popular'
  | 'trending'
  | 'price';
