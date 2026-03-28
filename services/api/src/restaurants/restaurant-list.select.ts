/**
 * Shared list projection for GET /restaurants and RankingService helpers.
 *
 * Includes `rating_count` (Google review total) for display and popular ranking context.
 */
export const RESTAURANT_LIST_SELECT = {
  id: true,
  name_default: true,
  /** Lets clients load `/restaurants/:id/photo` only when a Places photo exists. */
  photo_reference: true,
  city: true,
  district: true,
  address_line1: true,
  cuisine_tags: true,
  price_level: true,
  veg_friendly: true,
  halal_certified: true,
  created_at: true,
  rating: true,
  /** Google `user_ratings_total` (import / backfill). */
  rating_count: true,
} as const;
