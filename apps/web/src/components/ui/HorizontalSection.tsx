'use client';

import { RestaurantCard } from './RestaurantCard';
import type { Restaurant as RestaurantType } from '@/types/restaurant';
import { SkeletonCard, SkeletonRow } from './Skeleton';
import { HorizontalScroll } from './HorizontalScroll';
import { HomeSectionHeader } from '@/components/home/HomeSectionHeader';

const MOBILE_RESTAURANT_COUNT = 4;
const DESKTOP_RESTAURANT_COUNT = 5;

export type HorizontalSectionProps = {
  title: string;
  subtitle?: string | null;
  locationLabel?: string | null;
  restaurants: RestaurantType[];
  maxItems?: number;
  isLoading?: boolean;
  emptyMessage?: string;
  onSeeAll?: () => void;
  seeAllHref?: string;
  /** Mobile 2×2 grid; desktop horizontal rail (Popular / Top Rated). */
  mobileGridLayout?: boolean;
  /** Always horizontal scroll on all breakpoints (Trending). */
  scrollOnly?: boolean;
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
  seeAllHref,
  mobileGridLayout = false,
  scrollOnly = false,
  hasToken,
  favouriteIds,
  favouriteLoadingId,
  onFavoriteClick,
}: HorizontalSectionProps) {
  const list = restaurants.slice(0, maxItems);
  const mobileList = list.slice(0, MOBILE_RESTAURANT_COUNT);
  const desktopList = list.slice(0, DESKTOP_RESTAURANT_COUNT);

  return (
    <section className="scroll-mt-4" aria-busy={isLoading}>
      <HomeSectionHeader
        title={title}
        subtitle={subtitle}
        meta={locationLabel}
        onSeeAll={onSeeAll}
        seeAllHref={seeAllHref}
      />

      <div className="relative">
        <div
          className={`transition-opacity duration-200 ease-out ${
            isLoading
              ? 'relative z-[2] opacity-100'
              : 'pointer-events-none absolute inset-0 z-0 opacity-0'
          }`}
          aria-hidden={!isLoading}
        >
          {mobileGridLayout && !scrollOnly ? (
            <>
              <ul className="grid grid-cols-2 gap-3 md:hidden">
                {Array.from({ length: MOBILE_RESTAURANT_COUNT }).map((_, i) => (
                  <li key={i} className="flex min-h-0">
                    <SkeletonCard variant="compact" className="w-full" />
                  </li>
                ))}
              </ul>
              <div className="hidden md:block">
                <SkeletonRow count={DESKTOP_RESTAURANT_COUNT} />
              </div>
            </>
          ) : (
            <SkeletonRow count={scrollOnly ? 7 : DESKTOP_RESTAURANT_COUNT} />
          )}
        </div>

        {!isLoading && list.length === 0 ? (
          <p
            className="lm-fade-in rounded-lg border border-dashed px-4 py-6 text-center text-small"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            {emptyMessage}
          </p>
        ) : !isLoading ? (
          <div className="relative z-[2] transition-opacity duration-200 ease-out lm-fade-in opacity-100">
            {mobileGridLayout && !scrollOnly ? (
              <>
                <ul className="grid grid-cols-2 gap-3 md:hidden">
                  {mobileList.map((r) => (
                    <li key={`${r.id}-m`} className="flex min-h-0">
                      <RestaurantCard
                        variant="compact"
                        restaurant={r}
                        isFavorite={hasToken && favouriteIds.has(r.id)}
                        favoriteLoading={favouriteLoadingId === r.id}
                        onFavoriteClick={() => onFavoriteClick(r)}
                        showFavorite={hasToken}
                        className="w-full"
                      />
                    </li>
                  ))}
                </ul>
                <div className="hidden gap-4 overflow-x-auto hide-scrollbar md:flex [-webkit-overflow-scrolling:touch]">
                  {desktopList.map((r) => (
                    <div
                      key={`${r.id}-d`}
                      className="flex w-[min(326px,calc(100vw-5rem))] shrink-0 snap-start flex-col sm:w-[336px]"
                    >
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
                </div>
              </>
            ) : (
              <HorizontalScroll>
                {list.map((r) => (
                  <div
                    key={r.id}
                    className="flex w-[min(326px,calc(100vw-5rem))] shrink-0 snap-start flex-col sm:w-[336px]"
                  >
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
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
