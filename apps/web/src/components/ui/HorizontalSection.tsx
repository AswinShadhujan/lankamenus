'use client';

import { RestaurantCard } from './RestaurantCard';
import type { Restaurant as RestaurantType } from '@/types/restaurant';
import { SkeletonRow } from './Skeleton';
import { HorizontalScroll } from './HorizontalScroll';
import { HomeSectionHeader } from '@/components/home/HomeSectionHeader';

export type HorizontalSectionProps = {
  title: string;
  /** Muted line under title (e.g. location-aware subtitle). */
  subtitle?: string | null;
  /** Optional suffix from `getLocationLabel` — appended to subtitle line. */
  locationLabel?: string | null;
  restaurants: RestaurantType[];
  maxItems?: number;
  isLoading?: boolean;
  emptyMessage?: string;
  onSeeAll?: () => void;
  hasToken: boolean;
  favouriteIds: Set<number>;
  favouriteLoadingId: number | null;
  onFavoriteClick: (restaurant: RestaurantType) => void;
};

export function HorizontalSection({
  title,
  subtitle = null,
  locationLabel = null,
  restaurants,
  maxItems = 12,
  isLoading = false,
  emptyMessage = 'No results',
  onSeeAll,
  hasToken,
  favouriteIds,
  favouriteLoadingId,
  onFavoriteClick,
}: HorizontalSectionProps) {
  const list = restaurants.slice(0, maxItems);

  return (
    <section className="scroll-mt-4" aria-busy={isLoading}>
      <HomeSectionHeader
        title={title}
        subtitle={subtitle}
        meta={locationLabel}
        onSeeAll={onSeeAll}
      />

      <div className="relative">
        {/* Loading rail — fades out when data arrives */}
        <div
          className={`transition-opacity duration-200 ease-out ${
            isLoading
              ? 'relative z-[2] opacity-100'
              : 'pointer-events-none absolute inset-0 z-0 opacity-0'
          }`}
          aria-hidden={!isLoading}
        >
          <SkeletonRow count={7} />
        </div>

        {!isLoading && list.length === 0 ? (
          <p
            className="lm-fade-in rounded-lg border border-dashed px-4 py-6 text-center text-small"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            {emptyMessage}
          </p>
        ) : !isLoading ? (
          <div
            className={`relative z-[2] transition-opacity duration-200 ease-out lm-fade-in opacity-100`}
          >
            <HorizontalScroll>
              {list.map((r) => (
                <div key={r.id} className="min-w-[240px] max-w-[280px] flex-shrink-0 snap-start">
                  <RestaurantCard
                    variant="rail"
                    restaurant={r}
                    isFavorite={hasToken && favouriteIds.has(r.id)}
                    favoriteLoading={favouriteLoadingId === r.id}
                    onFavoriteClick={() => onFavoriteClick(r)}
                    showFavorite={hasToken}
                  />
                </div>
              ))}
            </HorizontalScroll>
          </div>
        ) : null}
      </div>
    </section>
  );
}
