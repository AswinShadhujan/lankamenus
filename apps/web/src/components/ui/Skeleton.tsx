'use client';

import { HorizontalScroll } from '@/components/ui/HorizontalScroll';

type SkeletonBlockProps = {
  className?: string;
};

/** Neutral block with shimmer (see `.skeleton-shimmer` in globals.css). */
export function Skeleton({ className = '' }: SkeletonBlockProps) {
  return <div className={`skeleton-shimmer rounded-md ${className}`} aria-hidden />;
}

export type SkeletonCardVariant = 'grid' | 'rail';

type SkeletonCardProps = {
  /** `grid` matches default `RestaurantCard`; `rail` matches `variant="rail"`. */
  variant?: SkeletonCardVariant;
  className?: string;
};

/**
 * Restaurant card placeholder — dimensions aligned with `RestaurantCard`
 * (image aspect, padding, min-heights) to avoid layout shift.
 */
export function SkeletonCard({ variant = 'grid', className = '' }: SkeletonCardProps) {
  const isRail = variant === 'rail';

  return (
    <div
      className={`overflow-hidden rounded-xl border shadow-sm ${
        isRail ? 'w-full max-w-[280px]' : 'flex h-full min-h-0 w-full flex-col'
      } ${className}`}
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
      aria-hidden
    >
      <Skeleton
        className={`w-full shrink-0 ${isRail ? 'aspect-[4/3]' : 'aspect-[16/9]'}`}
      />
      <div
        className={`flex flex-1 flex-col ${isRail ? 'p-3' : 'min-h-[7.25rem] p-4'}`}
      >
        <Skeleton className="mb-1 min-h-[2.5rem] w-[88%]" />
        <div
          className={`flex min-h-[1.35rem] flex-wrap items-center gap-1.5 ${
            isRail ? 'mb-1' : 'mb-2'
          }`}
        >
          <Skeleton className="h-5 w-14 shrink-0 rounded-md" />
          <Skeleton className="h-4 min-w-0 max-w-[65%] flex-1" />
        </div>
        <div className="mt-auto space-y-0.5">
          <Skeleton className={isRail ? 'h-3 w-24' : 'h-4 w-32'} />
          <Skeleton className={isRail ? 'h-3 w-[92%]' : 'h-4 w-4/5'} />
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
        <div key={i} className="min-w-[240px] max-w-[280px] flex-shrink-0 snap-start">
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
