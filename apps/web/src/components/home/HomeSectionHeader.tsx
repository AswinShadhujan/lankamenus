'use client';

import type { ReactNode } from 'react';
import { UBER_EATS_ACCENT } from '@/components/ui/UberEatsPill';

type HomeSectionHeaderProps = {
  title: ReactNode;
  subtitle?: string | null;
  /** Muted line (e.g. location) shown after subtitle. */
  meta?: string | null;
  onSeeAll?: () => void;
  /** Extra right-side content (e.g. result count). Shown before See all. */
  rightSlot?: ReactNode;
};

export function HomeSectionHeader({
  title,
  subtitle = null,
  meta = null,
  onSeeAll,
  rightSlot,
}: HomeSectionHeaderProps) {
  const detail =
    [subtitle?.trim(), meta?.trim()].filter(Boolean).join(' · ') || null;

  return (
    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h2 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-lg font-semibold leading-tight tracking-tight sm:text-xl">
          <span style={{ color: 'var(--text-primary)' }}>{title}</span>
        </h2>
        {detail ? (
          <p className="mt-0.5 text-sm font-normal" style={{ color: 'var(--text-secondary)' }}>
            {detail}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-3 sm:pt-0.5">
        {rightSlot}
        {onSeeAll ? (
          <button
            type="button"
            onClick={onSeeAll}
            className="text-sm font-semibold transition-opacity hover:opacity-80 hover:underline"
            style={{ color: UBER_EATS_ACCENT }}
          >
            See all
          </button>
        ) : null}
      </div>
    </div>
  );
}
