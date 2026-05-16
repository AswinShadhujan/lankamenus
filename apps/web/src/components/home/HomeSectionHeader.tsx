'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

type HomeSectionHeaderProps = {
  title: ReactNode;
  subtitle?: string | null;
  /** Muted line (e.g. location) shown after subtitle. */
  meta?: string | null;
  onSeeAll?: () => void;
  seeAllHref?: string;
  /** Extra right-side content (e.g. result count). Shown before See all. */
  rightSlot?: ReactNode;
};

export function HomeSectionHeader({
  title,
  subtitle = null,
  meta = null,
  onSeeAll,
  seeAllHref,
  rightSlot,
}: HomeSectionHeaderProps) {
  const detail =
    [subtitle?.trim(), meta?.trim()].filter(Boolean).join(' · ') || null;

  return (
    <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h2 className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm font-medium leading-snug">
          <span style={{ color: 'var(--text-secondary)' }}>{title}</span>
        </h2>
        {detail ? (
          <p className="mt-0.5 text-xs font-normal" style={{ color: 'var(--text-secondary)' }}>
            {detail}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {rightSlot}
        {seeAllHref ? (
          <Link
            href={seeAllHref}
            className="text-xs font-medium transition-opacity hover:opacity-80"
            style={{ color: 'var(--text-secondary)' }}
          >
            See all
          </Link>
        ) : onSeeAll ? (
          <button
            type="button"
            onClick={onSeeAll}
            className="text-xs font-medium transition-opacity hover:opacity-80"
            style={{ color: 'var(--text-secondary)' }}
          >
            See all
          </button>
        ) : null}
      </div>
    </div>
  );
}
