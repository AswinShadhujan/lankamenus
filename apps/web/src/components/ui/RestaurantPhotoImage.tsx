'use client';

import { useEffect, useState } from 'react';
import { getApiBaseUrl } from '@/lib/api';
import {
  hasRestaurantPhoto,
  RESTAURANT_PLACEHOLDER_IMAGE,
} from '@/lib/restaurant-photo';

type RestaurantPhotoImageProps = {
  restaurant: {
    id: number;
    photo_reference?: string | null;
    media_asset?: { secure_url?: string | null } | null;
  };
  className?: string;
  alt?: string;
};

type LoadMode = 'direct' | 'proxy' | 'placeholder' | 'solid';

/**
 * Cover image: managed media (Cloudinary / external URL) first, else Google Places proxy, else placeholder.
 */
export function RestaurantPhotoImage({
  restaurant,
  className,
  alt = '',
}: RestaurantPhotoImageProps) {
  const apiBase = getApiBaseUrl();
  const directUrl = restaurant.media_asset?.secure_url?.trim() ?? '';
  const hasGoogle = Boolean(restaurant.photo_reference?.trim());
  const canUseProxy = hasGoogle && apiBase.length > 0;
  const proxyUrl = canUseProxy
    ? `${apiBase.replace(/\/$/, '')}/restaurants/${restaurant.id}/photo`
    : '';

  const [mode, setMode] = useState<LoadMode>(() => {
    if (directUrl) return 'direct';
    if (canUseProxy) return 'proxy';
    return 'placeholder';
  });

  useEffect(() => {
    if (directUrl) setMode('direct');
    else if (canUseProxy) setMode('proxy');
    else setMode('placeholder');
  }, [restaurant.id, restaurant.photo_reference, restaurant.media_asset?.secure_url, canUseProxy, directUrl]);

  if (mode === 'solid') {
    return (
      <div
        className={className}
        style={{ backgroundColor: 'var(--border)' }}
        aria-hidden
      />
    );
  }

  if (mode === 'direct' && directUrl) {
    return (
      <img
        src={directUrl}
        alt={alt}
        className={className}
        onError={() => setMode(canUseProxy ? 'proxy' : 'placeholder')}
      />
    );
  }

  if (mode === 'proxy' && proxyUrl) {
    return (
      <img
        src={proxyUrl}
        alt={alt}
        className={className}
        onError={() => setMode('placeholder')}
      />
    );
  }

  return (
    <img
      src={RESTAURANT_PLACEHOLDER_IMAGE}
      alt={alt}
      className={className}
      onError={() => setMode('solid')}
    />
  );
}
