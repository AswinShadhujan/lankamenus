'use client';

import { RestaurantCard } from './RestaurantCard';
import type { Restaurant as RestaurantType } from '@/types/restaurant';
import { SkeletonCard } from './Skeleton';
import { HorizontalScroll } from './HorizontalScroll';
import { HomeSectionHeader } from '@/components/home/HomeSectionHeader';
import { HomeRailCarousel, HOME_RAIL_ITEM_ATTR } from '@/components/ui/HomeRailCarousel';

const DESKTOP_RESTAURANT_COUNT = 5;
const RESTAURANT_RAIL_CARD_WIDTH =
  'flex w-[min(326px,calc(100vw-5rem))] shrink-0 snap-start flex-col sm:w-[336px]';

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
  /** Homepage rails — arrow carousel on all breakpoints. */
  mobileGridLayout?: boolean;
  /** Always horizontal scroll on all breakpoints (Trending). */
  scrollOnly?: boolean;
  hasToken: boolean;
  favouriteIds: Set<number>;
  favouriteLoadingId: number | null;
  onFavoriteClick: (restaurant: RestaurantType) => void;
};

function renderRestaurantRailItems(
  items: RestaurantType[],
  hasToken: boolean,
  favouriteIds: Set<number>,
  favouriteLoadingId: number | null,
  onFavoriteClick: (restaurant: RestaurantType) => void,
) {
  return items.map((r) => (
    <div key={r.id} {...{ [HOME_RAIL_ITEM_ATTR]: '' }} className={RESTAURANT_RAIL_CARD_WIDTH}>
      <RestaurantCard
        variant="rail"
        restaurant={r}
        isFavorite={hasToken && favouriteIds.has(r.id)}
        favoriteLoading={favouriteLoadingId === r.id}
        onFavoriteClick={() => onFavoriteClick(r)}
        showFavorite={hasToken}
      />
    </div>
  ));
}

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
  const useArrowCarousel = mobileGridLayout || scrollOnly;
  const carouselList =
    mobileGridLayout && !scrollOnly ? list.slice(0, DESKTOP_RESTAURANT_COUNT) : list;
  const skeletonCount =
    mobileGridLayout && !scrollOnly ? DESKTOP_RESTAURANT_COUNT : scrollOnly ? 7 : DESKTOP_RESTAURANT_COUNT;

  const restaurantRailCarousel = (items: RestaurantType[]) => (
    <HomeRailCarousel
      className="px-1 sm:px-3"
      prevLabel="Previous restaurants"
      nextLabel="Next restaurants"
    >
      {renderRestaurantRailItems(
        items,
        hasToken,
        favouriteIds,
        favouriteLoadingId,
        onFavoriteClick,
      )}
    </HomeRailCarousel>
  );

  const restaurantRailSkeleton = (
    <HomeRailCarousel
      className="px-1 sm:px-3"
      prevLabel="Previous restaurants"
      nextLabel="Next restaurants"
    >
      {Array.from({ length: skeletonCount }).map((_, i) => (
        <div key={i} {...{ [HOME_RAIL_ITEM_ATTR]: '' }} className={RESTAURANT_RAIL_CARD_WIDTH}>
          <SkeletonCard variant="rail" />
        </div>
      ))}
    </HomeRailCarousel>
  );

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
          {useArrowCarousel ? restaurantRailSkeleton : (
            <div className="flex gap-4 overflow-x-auto hide-scrollbar [-webkit-overflow-scrolling:touch]">
              {Array.from({ length: skeletonCount }).map((_, i) => (
                <div key={i} className={RESTAURANT_RAIL_CARD_WIDTH}>
                  <SkeletonCard variant="rail" />
                </div>
              ))}
            </div>
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
            {useArrowCarousel ? (
              restaurantRailCarousel(carouselList)
            ) : (
              <HorizontalScroll>
                {list.map((r) => (
                  <div key={r.id} className={RESTAURANT_RAIL_CARD_WIDTH}>
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
