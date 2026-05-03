'use client';

import { HorizontalScroll } from '@/components/ui/HorizontalScroll';

type SkeletonBlockProps = {
  className?: string;
};

/** Neutral block with shimmer (see `.skeleton-shimmer` in globals.css). */
export function Skeleton({ className = '' }: SkeletonBlockProps) {
  return <div className={`skeleton-shimmer rounded-md ${className}`} aria-hidden />;
}

export type SkeletonCardVariant = 'grid' | 'rail' | 'compact';

type SkeletonCardProps = {
  /** `grid` / `compact` vs default `RestaurantCard`; `rail` vs `variant="rail"`. */
  variant?: SkeletonCardVariant;
  className?: string;
};

/**
 * Restaurant card placeholder — dimensions aligned with `RestaurantCard`
 * (image aspect, padding, min-heights) to avoid layout shift.
 */
export function SkeletonCard({ variant = 'grid', className = '' }: SkeletonCardProps) {
  const isRail = variant === 'rail';
  const isCompact = variant === 'compact';

  return (
    <div
      className={`lm-card-shadow flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border ${className}`}
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
      aria-hidden
    >
      <Skeleton
        className={`w-full shrink-0 ${
          isRail ? 'aspect-[16/10]' : isCompact ? 'aspect-[2/1]' : 'aspect-[16/9]'
        }`}
      />
      <div
        className={`flex min-h-0 flex-1 flex-col ${
          isRail ? 'p-3' : isCompact ? 'min-h-[5.25rem] p-3' : 'min-h-[7.25rem] p-4'
        }`}
      >
        <Skeleton
          className={`mb-1 w-[88%] rounded-md ${
            isRail
              ? 'h-[2.5rem]'
              : isCompact
                ? 'h-[2.75rem]'
                : 'h-[2.75rem]'
          }`}
        />
        <div
          className={`flex flex-wrap items-center gap-1.5 overflow-hidden ${
            isRail
              ? 'mb-1 h-6 shrink-0'
              : isCompact
                ? 'mb-1 min-h-6 shrink-0'
                : 'mb-2 min-h-[1.35rem]'
          }`}
        >
          <Skeleton className="h-5 w-14 shrink-0 rounded-md" />
          <Skeleton
            className={`min-w-0 max-w-[65%] flex-1 rounded-md ${isRail || isCompact ? 'h-[1.375rem]' : 'h-4'}`}
          />
        </div>
        <div
          className={`mt-auto space-y-0.5 ${isRail ? 'min-h-[2.5rem]' : isCompact ? 'min-h-[2rem]' : ''}`}
        >
          <Skeleton className={isRail || isCompact ? 'h-3 w-24 rounded-md' : 'h-4 w-32 rounded-md'} />
          <Skeleton className={isRail || isCompact ? 'h-3 w-[92%] rounded-md' : 'h-4 w-4/5 rounded-md'} />
        </div>
      </div>
    </div>
  );
}

const RAIL_SKELETON_COUNT_DEFAULT = 7;

type SkeletonRowProps = {
  /** Number of cards in the horizontal rail (6–8 recommended). */
  count?: number;
  className?: string;
};

/**
 * Horizontal discovery rail placeholder — same scroll wrapper and gaps as real rails.
 */
export function SkeletonRow({ count = RAIL_SKELETON_COUNT_DEFAULT, className = '' }: SkeletonRowProps) {
  const n = Math.min(Math.max(count, 6), 8);
  return (
    <HorizontalScroll className={className}>
      {Array.from({ length: n }).map((_, i) => (
        <div
          key={i}
          className="flex w-[min(326px,calc(100vw-5rem))] shrink-0 snap-start flex-col sm:w-[336px]"
        >
          <SkeletonCard variant="rail" />
        </div>
      ))}
    </HorizontalScroll>
  );
}

/** @deprecated Prefer `SkeletonCard` with `variant="grid"`. */
export function RestaurantCardSkeleton({ className = '' }: { className?: string }) {
  return <SkeletonCard variant="grid" className={className} />;
}

/** @deprecated Prefer `SkeletonCard` with `variant="rail"`. */
export function RestaurantCardSkeletonRail({ className = '' }: { className?: string }) {
  return <SkeletonCard variant="rail" className={className} />;
}

export function DishRowSkeleton() {
  return (
    <div className="flex gap-4 p-4">
      <Skeleton className="h-5 flex-1" />
      <Skeleton className="h-5 w-16 shrink-0" />
    </div>
  );
}
