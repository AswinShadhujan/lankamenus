export const BANNER_CTA_TYPES = [
  'restaurants_list',
  'restaurant_detail',
  'cuisine',
  'custom_url',
] as const;

export type BannerCtaType = (typeof BANNER_CTA_TYPES)[number];
