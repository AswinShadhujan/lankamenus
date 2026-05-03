'use client';

import { normalizeRestaurantCategories } from '@/lib/foodCategories';

type Props = {
  /** Raw `cuisine_tags` from API — normalized to known categories for display. */
  tags: string[] | null | undefined;
  /** Include tags not in FOOD_CATEGORIES (muted) so legacy data still shows. */
  showUnknown?: boolean;
  /** Limit number of known chips (e.g. cards); +N suffix when truncated. */
  maxKnown?: number;
  /** Single row, clip overflow — keeps compact rail cards a uniform height. */
  nowrap?: boolean;
  className?: string;
  size?: 'sm' | 'md';
};

/**
 * Read-only category chips for restaurant detail / cards.
 */
export function RestaurantCategoryChips({
  tags,
  showUnknown = true,
  maxKnown,
  nowrap = false,
  className = '',
  size = 'md',
}: Props) {
  const raw = Array.isArray(tags) ? tags.map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean) : [];
  const knownFull = normalizeRestaurantCategories(raw);
  const unknown = showUnknown
    ? [...new Set(raw.filter((t) => !knownFull.includes(t)))]
    : [];

  const known =
    maxKnown != null && maxKnown >= 0
      ? knownFull.slice(0, maxKnown)
      : knownFull;
  const moreKnown =
    maxKnown != null && knownFull.length > known.length
      ? knownFull.length - known.length
      : 0;

  if (known.length === 0 && unknown.length === 0 && moreKnown === 0) {
    return null;
  }

  const pill =
    size === 'sm'
      ? 'rounded-full px-2 py-0.5 text-[10px] font-medium sm:text-xs'
      : 'rounded-full px-2.5 py-1 text-xs font-medium sm:text-sm';

  return (
    <div
      className={`flex gap-1.5 sm:gap-2 ${nowrap ? 'min-w-0 flex-nowrap overflow-hidden' : 'flex-wrap'} ${className}`}
    >
      {known.map((label) => (
        <span
          key={label}
          className={`shrink-0 ${pill}`}
          style={{
            color: 'var(--text-primary)',
            backgroundColor: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent-primary) 25%, transparent)',
          }}
        >
          {label}
        </span>
      ))}
      {unknown.map((label) => (
        <span
          key={`u-${label}`}
          className={`shrink-0 ${pill}`}
          style={{
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
          }}
        >
          {label}
        </span>
      ))}
      {moreKnown > 0 ? (
        <span
          className={`shrink-0 ${pill}`}
          style={{
            color: 'var(--text-secondary)',
            border: '1px dashed var(--border)',
          }}
        >
          +{moreKnown}
        </span>
      ) : null}
    </div>
  );
}
