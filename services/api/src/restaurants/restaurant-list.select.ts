/**
 * Shared list projection for GET /restaurants and RankingService helpers.
 *
 * Includes `rating_count` (Google review total) for display and popular ranking context.
 */
export const RESTAURANT_LIST_SELECT = {
  id: true,
  name_default: true,
  media_asset_id: true,
  media_asset: {
    select: {
      id: true,
      source_type: true,
      secure_url: true,
    },
  },
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
  /** Used for lat/lng-only (bias) distance ordering on the homepage. */
  latitude: true,
  longitude: true,
  rating: true,
  /** Google `user_ratings_total` (import / backfill). */
  rating_count: true,
  /** DB-generated; used for geo-blended popular / trending sorts. */
  popular_score: true,
  trending_score: true,
} as const;
