/** Shape of query params that affect GET /restaurants (avoid circular imports). */
export type RestaurantsSearchCacheDto = {
  page?: string;
  limit?: string;
  pagesize?: string;
  q?: string;
  city?: string;
  district?: string;
  cuisine?: string;
  veg?: string;
  halal?: string;
  pricelevel?: string | string[];
  lat?: string;
  lng?: string;
  radius_km?: string;
  sort?: string;
};

/** TTL in seconds for cached single-resource responses (restaurant, menu). */
export const CACHE_TTL_ENTITY = 300; // 5 min

/** @deprecated Use env CACHE_TTL_RESTAURANTS_*; kept for non-restaurant list caches if any. */
export const CACHE_TTL_LIST = 120;

export const CACHE_KEY_RESTAURANT = (id: number) => `restaurant:${id}`;
export const CACHE_KEY_MENU = (id: number) => `menu:${id}`;

/**
 * Prefix for GET /restaurants list responses. Invalidation uses SCAN `restaurants:list:*`.
 */
export const CACHE_PREFIX_RESTAURANTS_LIST = 'restaurants:list:';

/** Pattern for invalidating all restaurant list caches after mutations. */
export const CACHE_PATTERN_RESTAURANTS_LIST = 'restaurants:list:*';

/** Session store (optional Redis sessions). TTL in seconds. */
export const SESSION_TTL_SECONDS = 604800; // 7 days
export const CACHE_KEY_SESSION = (sessionId: string) => `session:${sessionId}`;

/** Default TTLs (seconds); override via env in RestaurantsService. */
export const DEFAULT_TTL_RESTAURANTS_NEARBY = 60;
export const DEFAULT_TTL_RESTAURANTS_LIST = 120;
export const DEFAULT_TTL_RESTAURANTS_DISCOVERY = 300;

/**
 * Upper bound for `GET /restaurants` list cache TTL (per key `restaurants:list:*`).
 * Session and single-entity keys are not subject to this cap.
 */
export const MAX_RESTAURANTS_LIST_CACHE_TTL_SECONDS = 86_400; // 24h

/** GET /restaurants when sort=popular|top_rated|rating (Redis list cache). */
export const CACHE_TTL_RANKING_POPULAR_TOP_RATED = 300; // 5 min

/** GET /restaurants when sort=trending. */
export const CACHE_TTL_RANKING_TRENDING = 120; // 2 min

/** Max length of cache key material included in logs (PII / size safety). */
export const CACHE_KEY_LOG_MAX_LENGTH = 128;

function normalizeListParam(v: string | string[] | undefined): string {
  if (v == null) return '';
  if (Array.isArray(v)) {
    return v
      .map((s) => String(s).trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
      .join(',');
  }
  return String(v)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .join(',');
}

/**
 * Deterministic cache key for GET /restaurants.
 * Sorted param names; values are URI-encoded to avoid delimiter collisions.
 */
export function buildRestaurantsListCacheKey(
  dto: RestaurantsSearchCacheDto,
  page: number,
  resolvedLimit: number,
): string {
  const pairs: [string, string][] = [
    ['city', dto.city?.trim() ?? ''],
    ['cuisine', normalizeListParam(dto.cuisine)],
    ['district', dto.district?.trim() ?? ''],
    ['halal', dto.halal ?? ''],
    ['lat', dto.lat?.trim() ?? ''],
    ['limit', String(resolvedLimit)],
    ['lng', dto.lng?.trim() ?? ''],
    ['page', String(page)],
    ['pricelevel', normalizeListParam(dto.pricelevel)],
    ['q', dto.q?.trim() ?? ''],
    ['radius_km', dto.radius_km?.trim() ?? ''],
    ['sort', dto.sort ?? ''],
    ['veg', dto.veg ?? ''],
  ];
  pairs.sort((a, b) => a[0].localeCompare(b[0]));
  const esc = (s: string) => encodeURIComponent(s);
  const body = pairs.map(([k, v]) => `${k}=${esc(v)}`).join(':');
  return `${CACHE_PREFIX_RESTAURANTS_LIST}${body}`;
}
