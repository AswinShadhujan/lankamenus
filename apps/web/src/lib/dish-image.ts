import { resolvePublicMediaUrl } from '@/lib/api';

/** Prefer Cloudinary / media asset URL, then legacy `image_url`. */
export function resolveDishDisplayImageUrl(item: {
  image_url?: string | null;
  media_asset?: { secure_url?: string | null } | null;
}): string {
  const raw =
    item.media_asset?.secure_url?.trim() || item.image_url?.trim() || '';
  return resolvePublicMediaUrl(raw);
}
