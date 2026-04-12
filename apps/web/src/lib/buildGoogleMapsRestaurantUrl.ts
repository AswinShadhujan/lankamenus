import type { Restaurant } from '@/types/restaurant';

/**
 * Opens the restaurant in Google Maps: coordinates when present, otherwise a text search
 * (name + address + locality).
 */
export function buildGoogleMapsRestaurantUrl(restaurant: Restaurant): string {
  const lat = restaurant.latitude;
  const lng = restaurant.longitude;
  if (
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  ) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  const locality = [restaurant.city, restaurant.district].filter(Boolean).join(', ');
  const parts = [
    restaurant.name_default,
    restaurant.address_line1?.trim(),
    locality || undefined,
  ].filter((p): p is string => Boolean(p && String(p).trim()));
  const query = parts.join(', ') || restaurant.name_default;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
