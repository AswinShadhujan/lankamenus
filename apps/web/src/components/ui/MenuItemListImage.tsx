'use client';

import { useEffect, useState } from 'react';
import { resolvePublicMediaUrl } from '@/lib/api';

type MenuItemListImageProps = {
  url: string | null | undefined;
  alt: string;
  className?: string;
};

/**
 * Small square thumbnail for menu list rows. Hides itself if URL missing or image fails to load.
 */
export function MenuItemListImage({ url, alt, className = '' }: MenuItemListImageProps) {
  const [failed, setFailed] = useState(false);
  const resolved = resolvePublicMediaUrl(url);

  useEffect(() => {
    setFailed(false);
  }, [resolved]);

  if (!resolved || failed) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote dish URLs from CMS
    <img
      src={resolved}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={`h-14 w-14 shrink-0 rounded-lg border object-cover sm:h-16 sm:w-16 ${className}`}
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}
      onError={() => setFailed(true)}
    />
  );
}
