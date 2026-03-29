'use client';

import { useEffect, useState } from 'react';
import { getApiBaseUrl } from '@/lib/api';
import {
  hasRestaurantPhoto,
  RESTAURANT_PLACEHOLDER_IMAGE,
} from '@/lib/restaurant-photo';

type RestaurantPhotoImageProps = {
  restaurant: { id: number; photo_reference?: string | null };
  className?: string;
  alt?: string;
};

type LoadMode = 'proxy' | 'placeholder' | 'solid';

/**
 * Loads the Google Places photo via the API proxy (`GET /restaurants/:id/photo`).
 * If there is no `photo_reference`, skips the proxy (would 404) and shows the placeholder.
 */
export function RestaurantPhotoImage({
  restaurant,
  className,
  alt = '',
}: RestaurantPhotoImageProps) {
  const apiBase = getApiBaseUrl();
  const hasPhoto = hasRestaurantPhoto(restaurant);
  const canUseProxy = hasPhoto && apiBase.length > 0;
  const proxyUrl = canUseProxy
    ? `${apiBase.replace(/\/$/, '')}/restaurants/${restaurant.id}/photo`
    : '';

  const [mode, setMode] = useState<LoadMode>(() => (canUseProxy ? 'proxy' : 'placeholder'));

  useEffect(() => {
    setMode(canUseProxy ? 'proxy' : 'placeholder');
  }, [restaurant.id, restaurant.photo_reference, canUseProxy]);

  if (mode === 'solid') {
    return (
      <div
        className={className}
        style={{ backgroundColor: 'var(--border)' }}
        aria-hidden
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
