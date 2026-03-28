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
  const hasPhoto = hasRestaurantPhoto(restaurant);
  const proxyUrl = `${getApiBaseUrl()}/restaurants/${restaurant.id}/photo`;

  const [mode, setMode] = useState<LoadMode>(() =>
    hasPhoto ? 'proxy' : 'placeholder',
  );

  useEffect(() => {
    setMode(hasPhoto ? 'proxy' : 'placeholder');
  }, [restaurant.id, restaurant.photo_reference, hasPhoto]);

  if (mode === 'solid') {
    return (
      <div
        className={className}
        style={{ backgroundColor: 'var(--border)' }}
        aria-hidden
      />
    );
  }

  if (mode === 'proxy') {
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
