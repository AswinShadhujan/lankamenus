export type BannerCtaType =
  | 'restaurants_list'
  | 'restaurant_detail'
  | 'cuisine'
  | 'custom_url';

export type BannerCtaPayload = {
  cta_type?: BannerCtaType | null;
  cta_url?: string | null;
  restaurant_id?: number | null;
  cuisine_key?: string | null;
};

export function resolveBannerHref(b: BannerCtaPayload): string {
  const type = b.cta_type ?? (b.cta_url ? 'custom_url' : 'restaurants_list');
  if (type === 'restaurant_detail' && b.restaurant_id) {
    return `/restaurants/${b.restaurant_id}`;
  }
  if (type === 'cuisine' && b.cuisine_key?.trim()) {
    return `/?categories=${encodeURIComponent(b.cuisine_key.trim())}`;
  }
  if (type === 'custom_url' && b.cta_url?.trim()) {
    return b.cta_url.trim();
  }
  return '/#all-restaurants';
}
