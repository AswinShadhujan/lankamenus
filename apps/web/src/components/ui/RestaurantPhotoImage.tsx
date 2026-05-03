'use client';

import { useEffect, useState } from 'react';
import { getApiBaseUrl } from '@/lib/api';
import { isValidRestaurantImage } from '@/lib/restaurant-photo';

type RestaurantPhotoImageProps = {
  restaurant: {
    id: number;
    photo_reference?: string | null;
    media_asset?: { secure_url?: string | null } | null;
  };
  className?: string;
  alt?: string;
};

type LoadMode = 'direct' | 'proxy' | 'fallback';

/** Neutral gradient + icon when no photo or all image loads fail (no external asset dependency). */
function RestaurantPhotoFallback({ className }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center ${className ?? ''}`}
      aria-hidden
      style={{
        background:
          'linear-gradient(155deg, color-mix(in srgb, var(--border) 38%, var(--surface)) 0%, var(--surface) 45%, color-mix(in srgb, var(--accent-primary) 12%, var(--surface)) 100%)',
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="36"
        height="36"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="opacity-[0.2]"
        style={{ color: 'var(--text-primary)' }}
      >
        <path d="M3 2v7c0 1.66 1.34 3 3 3h4c1.66 0 3-1.34 3-3V2" />
        <path d="M7 2v20" />
        <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h0" />
        <path d="M21 15v7" />
      </svg>
    </div>
  );
}

/**
 * Cover image: managed media first, else Google Places proxy, else neutral branded fallback.
 */
export function RestaurantPhotoImage({
  restaurant,
  className,
  alt = '',
}: RestaurantPhotoImageProps) {
  const apiBase = getApiBaseUrl();
  const rawDirect = restaurant.media_asset?.secure_url?.trim() ?? '';
  const directUrl = isValidRestaurantImage(rawDirect) ? rawDirect : '';
  const hasGoogle = Boolean(restaurant.photo_reference?.trim());
  const canUseProxy = hasGoogle && apiBase.length > 0;
  const proxyUrl = canUseProxy
    ? `${apiBase.replace(/\/$/, '')}/restaurants/${restaurant.id}/photo`
    : '';

  const [mode, setMode] = useState<LoadMode>(() => {
    if (directUrl) return 'direct';
    if (canUseProxy) return 'proxy';
    return 'fallback';
  });

  useEffect(() => {
    if (directUrl) setMode('direct');
    else if (canUseProxy) setMode('proxy');
    else setMode('fallback');
  }, [restaurant.id, restaurant.photo_reference, restaurant.media_asset?.secure_url, canUseProxy, directUrl]);

  if (mode === 'fallback') {
    return <RestaurantPhotoFallback className={className} />;
  }

  if (mode === 'direct' && directUrl) {
    return (
      <img
        src={directUrl}
        alt={alt}
        className={className}
        onError={() => setMode(canUseProxy ? 'proxy' : 'fallback')}
      />
    );
  }

  if (mode === 'proxy' && proxyUrl) {
    return (
      <img
        src={proxyUrl}
        alt={alt}
        className={className}
        onError={() => setMode('fallback')}
      />
    );
  }

  return <RestaurantPhotoFallback className={className} />;
}
