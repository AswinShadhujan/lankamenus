/** Static asset in `public/images/` — used when there is no photo or the proxy fails. */
export const RESTAURANT_PLACEHOLDER_IMAGE = '/images/restaurant-placeholder.png';

/**
 * Rejects URLs that are not real venue photos (e.g. static map tiles stored as image URLs).
 */
export function isValidRestaurantImage(url: string | null | undefined): boolean {
  const u = url?.trim();
  if (!u) return false;
  const lower = u.toLowerCase();
  if (lower.includes('maps.googleapis.com/maps/api/staticmap')) return false;
  if (lower.includes('/staticmap?')) return false;
  if (lower.includes('openstreetmap') && lower.includes('static')) return false;
  return true;
}

/** Display name for cards when API data is empty or placeholder dashes. */
export function getRestaurantDisplayName(name: string | null | undefined): string {
  const t = name?.trim() ?? '';
  if (!t || /^[-–—_\s]+$/.test(t)) return 'Unknown Restaurant';
  return t;
}

export function hasRestaurantPhoto(restaurant: {
  photo_reference?: string | null;
  media_asset?: { secure_url?: string | null } | null;
}): boolean {
  const direct = restaurant.media_asset?.secure_url?.trim();
  if (isValidRestaurantImage(direct)) return true;
  return Boolean(restaurant.photo_reference?.trim());
}
