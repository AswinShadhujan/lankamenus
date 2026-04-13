/** Static asset in `public/images/` — used when there is no photo or the proxy fails. */
export const RESTAURANT_PLACEHOLDER_IMAGE = '/images/restaurant-placeholder.png';

export function hasRestaurantPhoto(restaurant: {
  photo_reference?: string | null;
  media_asset?: { secure_url?: string | null } | null;
}): boolean {
  return Boolean(
    restaurant.media_asset?.secure_url?.trim() || restaurant.photo_reference?.trim(),
  );
}
