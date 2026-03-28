/** Static asset in `public/images/` — used when there is no photo or the proxy fails. */
export const RESTAURANT_PLACEHOLDER_IMAGE = '/images/restaurant-placeholder.png';

export function hasRestaurantPhoto(restaurant: {
  photo_reference?: string | null;
}): boolean {
  return Boolean(restaurant.photo_reference?.trim());
}
