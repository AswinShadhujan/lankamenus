'use client';

import { useEffect, useState } from 'react';
import { resolvePublicMediaUrl } from '@/lib/api';

type MenuItemCardThumbnailProps = {
  url: string | null | undefined;
  alt: string;
  /** `compact` = smaller square (e.g. related-dish rows). Default matches main menu cards. */
  size?: 'default' | 'compact';
  /** Square size in px (Tailwind h/w). Default ~80px mobile, ~96px sm+. */
  className?: string;
};

/**
 * Fixed-size dish thumbnail for menu cards: lazy-loaded image or neutral placeholder (no layout shift).
 */
export function MenuItemCardThumbnail({
  url,
  alt,
  size = 'default',
  className = '',
}: MenuItemCardThumbnailProps) {
  const [failed, setFailed] = useState(false);
  const resolved = resolvePublicMediaUrl(url);

  useEffect(() => {
    setFailed(false);
  }, [resolved]);

  const sizeClass =
    size === 'compact'
      ? 'h-12 w-12 rounded-lg sm:h-14 sm:w-14'
      : 'h-20 w-20 rounded-xl sm:h-24 sm:w-24';

  const boxClass = `flex shrink-0 overflow-hidden border ${sizeClass} ${className}`.trim();

  if (!resolved || failed) {
    return (
      <div
        className={boxClass}
        style={{
          borderColor: 'var(--border)',
          backgroundColor: 'var(--surface)',
        }}
        aria-hidden
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote dish URLs
    <div
      className={boxClass}
      style={{
        borderColor: 'var(--border)',
        backgroundColor: 'var(--background)',
      }}
    >
      <img
        src={resolved}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
