'use client';

import { useEffect, useState } from 'react';
import { resolvePublicMediaUrl } from '@/lib/api';

/** Lazy image preview for admin dish URLs; resets on URL change. */
export function DishImagePreview({
  url,
  variant,
}: {
  url: string;
  variant: 'thumb' | 'editor';
}) {
  const [loadError, setLoadError] = useState(false);
  const resolved = resolvePublicMediaUrl(url.trim());

  useEffect(() => {
    setLoadError(false);
  }, [resolved]);

  if (!resolved) return null;

  if (loadError) {
    return (
      <div
        className={
          variant === 'thumb'
            ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded border border-dashed border-[var(--border)] bg-[var(--surface)] text-[8px] leading-tight text-[var(--text-secondary)]'
            : 'flex max-h-32 w-full max-w-md items-center justify-center rounded border border-dashed border-[var(--border)] bg-[var(--surface)] py-6 text-xs text-[var(--text-secondary)]'
        }
        role="img"
        aria-label="Image preview unavailable"
      >
        {variant === 'thumb' ? '—' : 'Could not load image'}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- admin previews arbitrary HTTPS URLs
    <img
      src={resolved}
      alt=""
      loading="lazy"
      decoding="async"
      className={
        variant === 'thumb'
          ? 'h-10 w-10 shrink-0 rounded border border-[var(--border)] bg-[var(--background)] object-cover'
          : 'max-h-48 w-full max-w-md rounded border border-[var(--border)] bg-[var(--background)] object-contain'
      }
      onError={() => setLoadError(true)}
    />
  );
}
