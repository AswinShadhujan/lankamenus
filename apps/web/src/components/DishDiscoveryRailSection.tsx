'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { resolvePublicMediaUrl } from '@/lib/api';
import { buildApiUrl } from '@/lib/buildApiUrl';
import type { DishDiscoveryItem } from '@/types/featuredDish';
import { HomeRailCarousel, HOME_RAIL_ITEM_ATTR } from '@/components/ui/HomeRailCarousel';
import { DishRailPrice } from '@/components/dish/DishRailPrice';
import { useHasMounted } from '@/hooks/useHasMounted';
import { HomeSectionHeader } from '@/components/home/HomeSectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { DishFavoriteButton } from '@/components/ui/DishFavoriteButton';
import { HorizontalScroll } from '@/components/ui/HorizontalScroll';

export type DishRailFavouritesProps = {
  isFavourited: (id: number) => boolean;
  onToggle: (id: number) => void | Promise<void>;
  loadingId: number | null;
};

export type DishDiscoveryRailSectionProps = {
  title: string;
  sectionSubtitle?: string | null;
  apiPath: '/dishes/featured' | '/dishes/trending' | '/dishes/nearby' | '/dishes';
  /** Initial geolocation attempt finished (any outcome). */
  locationReady: boolean;
  /**
   * Same `district` + geo keys as restaurant rails (`homeSharedQuery` from the homepage).
   */
  apiQuery: Record<string, string | number>;
  locationLabel?: string | null;
  badgeMode: 'popular' | 'trending';
  onSeeAll?: () => void;
  seeAllHref?: string;
  /** Mobile 2×2 grid + desktop horizontal rail (Popular / Trending dish sections). */
  mobileGridLayout?: boolean;
  /** When set, shows a favourite control on each dish image (single hook at page level). */
  dishFavourites?: DishRailFavouritesProps | null;
};

const DESKTOP_DISH_COUNT = 5;

function dishQueryHasScope(q: Record<string, string | number>): boolean {
  const d = q.district;
  if (typeof d === 'string' && d.trim() !== '') return true;
  if (q.lat != null) return true;
  const cat = q.category;
  if (typeof cat === 'string' && cat.trim() !== '') return true;
  return false;
}

function dishHref(d: DishDiscoveryItem): string {
  return `/restaurants/${d.restaurant.id}/menus/${d.menu_id}/items/${d.id}`;
}

function DishDiscoveryCard({
  dish,
  imageBadge,
  dishFavourites,
  variant = 'rail',
  className = '',
}: {
  dish: DishDiscoveryItem;
  imageBadge: ReactNode;
  dishFavourites: DishRailFavouritesProps | null;
  /** `compact` — mobile 2×2 grid; `rail` — desktop horizontal rail (matches `RestaurantCard`). */
  variant?: 'compact' | 'rail';
  className?: string;
}) {
  const href = dishHref(dish);
  const img = resolvePublicMediaUrl(dish.image_url);
  const isRail = variant === 'rail';
  const isCompact = variant === 'compact';

  return (
    <Link
      href={href}
      className={`lm-card-shadow group relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border outline-none transition-all duration-200 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent-primary)_55%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] md:hover:border-[color-mix(in_srgb,var(--border)_70%,var(--text-secondary))] md:hover:scale-[1.01] ${className}`}
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
    >
      <div
        className={`relative w-full shrink-0 overflow-hidden bg-[var(--border)] ${
          isRail ? 'aspect-[16/10]' : 'aspect-[2/1]'
        }`}
      >
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote dish URLs
          <img
            src={img}
            alt={dish.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-3xl opacity-50"
            aria-hidden
          >
            🍽
          </div>
        )}
        {imageBadge}
        {dishFavourites ? (
          <div
            className={`absolute right-2 top-2 z-[2] ${isRail || isCompact ? 'scale-90' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
            role="presentation"
          >
            <DishFavoriteButton
              isFavourited={dishFavourites.isFavourited(dish.id)}
              loading={dishFavourites.loadingId === dish.id}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void dishFavourites.onToggle(dish.id);
              }}
            />
          </div>
        ) : null}
      </div>
      <div
        className={`flex min-h-0 flex-1 flex-col ${
          isRail ? 'p-3' : 'min-h-[5rem] p-3'
        }`}
      >
        <h3
          className={`mb-1 font-semibold ${
            isRail
              ? 'line-clamp-2 h-[2.5rem] text-base leading-snug'
              : 'line-clamp-2 min-h-[2.125rem] text-sm leading-snug sm:text-base'
          }`}
          style={{ color: 'var(--text-primary)' }}
        >
          {dish.name}
        </h3>
        <div
          className={`shrink-0 overflow-hidden ${
            isRail ? 'mb-1 h-6' : 'mb-1 min-h-[1.125rem]'
          }`}
        >
          <DishRailPrice
            price={dish.price}
            currency={dish.currency}
            hasPortions={Boolean(dish.has_portions)}
          />
        </div>
        <div
          className={`mt-auto space-y-0.5 ${
            isRail ? 'min-h-[2.5rem] text-xs' : 'min-h-[1.875rem] text-xs'
          }`}
        >
          <p
            className={`line-clamp-1 ${isCompact ? 'text-xs' : 'text-[13px]'}`}
            style={{ color: 'var(--text-secondary)' }}
          >
            {dish.restaurant.name}
          </p>
          {isRail || isCompact ? (
            <p className="invisible h-[1rem] select-none leading-tight" aria-hidden>
              —
            </p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function PopularImageBadge() {
  return (
    <div className="absolute left-2 top-2 rounded-full bg-orange-500/90 px-2 py-1 text-xs font-medium text-white shadow-sm">
      🔥 Popular
    </div>
  );
}

function TrendingImageBadge() {
  return (
    <div className="absolute left-2 top-2 rounded-full bg-blue-500/90 px-2 py-1 text-xs font-medium text-white shadow-sm">
      ⚡ Trending
    </div>
  );
}

const DISH_RAIL_CARD_WIDTH =
  'flex w-[min(326px,calc(100vw-5rem))] shrink-0 snap-start flex-col sm:w-[336px]';

function DishCardSkeleton({ variant = 'rail' }: { variant?: 'compact' | 'rail' }) {
  const isRail = variant === 'rail';
  const isCompact = variant === 'compact';

  return (
    <div
      className="lm-card-shadow flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
      aria-hidden
    >
      <Skeleton
        className={`w-full shrink-0 rounded-none ${isRail ? 'aspect-[16/10]' : 'aspect-[2/1]'}`}
      />
      <div className={`flex min-h-0 flex-1 flex-col ${isRail ? 'p-3' : 'min-h-[5rem] p-3'}`}>
        <Skeleton
          className={`mb-1 w-[88%] rounded-md ${
            isRail ? 'h-[2.5rem]' : 'h-[2.125rem] min-h-[2.125rem]'
          }`}
        />
        <Skeleton className={`mb-1 rounded-md ${isRail ? 'h-6 w-20' : 'min-h-[1.125rem] h-[1.125rem] w-20'}`} />
        <div className={`mt-auto space-y-0.5 ${isRail ? 'min-h-[2.5rem]' : 'min-h-[1.875rem]'}`}>
          <Skeleton className="h-3 w-[78%] rounded-md" />
          <Skeleton className="h-3 w-24 rounded-md" />
        </div>
      </div>
    </div>
  );
}

function DishDiscoverySkeletonCarousel() {
  return (
    <HomeRailCarousel
      className="px-1 sm:px-3"
      prevLabel="Previous dishes"
      nextLabel="Next dishes"
    >
      {Array.from({ length: DESKTOP_DISH_COUNT }).map((_, i) => (
        <div key={i} {...{ [HOME_RAIL_ITEM_ATTR]: '' }} className={DISH_RAIL_CARD_WIDTH}>
          <DishCardSkeleton variant="rail" />
        </div>
      ))}
    </HomeRailCarousel>
  );
}

function renderHomeDishRailItems(
  items: DishDiscoveryItem[],
  imageBadge: ReactNode,
  dishFavourites: DishRailFavouritesProps | null,
) {
  return items.map((d) => (
    <div
      key={`${d.restaurant.id}-${d.menu_id}-${d.id}`}
      {...{ [HOME_RAIL_ITEM_ATTR]: '' }}
      className={DISH_RAIL_CARD_WIDTH}
    >
      <DishDiscoveryCard
        variant="rail"
        dish={d}
        imageBadge={imageBadge}
        dishFavourites={dishFavourites}
      />
    </div>
  ));
}

export function DishDiscoveryRailSection({
  title,
  sectionSubtitle = null,
  apiPath,
  locationReady,
  apiQuery,
  locationLabel = null,
  badgeMode,
  onSeeAll,
  seeAllHref,
  mobileGridLayout = false,
  dishFavourites = null,
}: DishDiscoveryRailSectionProps) {
  const hasMounted = useHasMounted();
  const [dishes, setDishes] = useState<DishDiscoveryItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasMounted || !locationReady) return;
    let cancelled = false;
    setLoading(true);

    const dishUrl = buildApiUrl(apiPath, apiQuery);

    fetch(dishUrl, { cache: 'no-store' })
      .then(async (res) => {
        const data: unknown = await res.json().catch(() => null);
        if (!Array.isArray(data)) {
          return [];
        }
        return data as DishDiscoveryItem[];
      })
      .then((res) => {
        if (!cancelled) setDishes(res);
      })
      .catch(() => {
        if (!cancelled) setDishes([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiPath, hasMounted, locationReady, apiQuery]);

  if (!hasMounted || !locationReady) {
    return null;
  }

  const hasLocationScope = dishQueryHasScope(apiQuery);
  const strictNearby = apiQuery.radius_km != null;
  const biasOnly = apiQuery.lat != null && apiQuery.radius_km == null;

  if (!loading && (!dishes || dishes.length === 0)) {
    if (!hasLocationScope) {
      return null;
    }
    const emptyCopy = strictNearby
      ? 'No dishes in this area yet. Try a different location or browse by district.'
      : biasOnly
        ? 'No dishes found for your area yet. Try a district filter or check back later.'
        : 'No dishes in the selected district yet. Try All Districts or pick another district.';
    return (
      <section className="scroll-mt-4">
        <HomeSectionHeader
          title={title}
          subtitle={sectionSubtitle}
          meta={locationLabel}
          onSeeAll={onSeeAll}
          seeAllHref={seeAllHref}
        />
        <p className="mt-2 max-w-xl text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {emptyCopy}
        </p>
      </section>
    );
  }

  const imageBadge = badgeMode === 'popular' ? <PopularImageBadge /> : <TrendingImageBadge />;
  const homeRailDishes = (dishes ?? []).slice(0, DESKTOP_DISH_COUNT);

  return (
    <section className="scroll-mt-4" aria-busy={loading}>
      <HomeSectionHeader
        title={title}
        subtitle={sectionSubtitle}
        meta={locationLabel}
        onSeeAll={onSeeAll}
        seeAllHref={seeAllHref}
      />

      <div className="relative">
        <div
          className={`transition-opacity duration-200 ease-out ${
            loading
              ? 'relative z-[2] opacity-100'
              : 'pointer-events-none absolute inset-0 z-0 opacity-0'
          }`}
          aria-hidden={!loading}
        >
          {mobileGridLayout ? (
            <DishDiscoverySkeletonCarousel />
          ) : (
            <div className="hidden gap-4 overflow-x-auto hide-scrollbar md:flex [-webkit-overflow-scrolling:touch]">
              {Array.from({ length: DESKTOP_DISH_COUNT }).map((_, i) => (
                <div key={i} className={DISH_RAIL_CARD_WIDTH}>
                  <DishCardSkeleton variant="rail" />
                </div>
              ))}
            </div>
          )}
        </div>

        {!loading && dishes && dishes.length > 0 ? (
          <div className="relative z-[2] transition-opacity duration-200 ease-out lm-fade-in opacity-100">
            {mobileGridLayout ? (
              <HomeRailCarousel
                className="px-1 sm:px-3"
                prevLabel="Previous dishes"
                nextLabel="Next dishes"
              >
                {renderHomeDishRailItems(homeRailDishes, imageBadge, dishFavourites)}
              </HomeRailCarousel>
            ) : (
              <HorizontalScroll>
                {dishes.map((d) => (
                  <div key={`${d.restaurant.id}-${d.menu_id}-${d.id}`} className={DISH_RAIL_CARD_WIDTH}>
                    <DishDiscoveryCard
                      variant="rail"
                      dish={d}
                      imageBadge={imageBadge}
                      dishFavourites={dishFavourites}
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

export function PopularDishesSection(
  props: Omit<
    DishDiscoveryRailSectionProps,
    'title' | 'apiPath' | 'badgeMode' | 'sectionSubtitle'
  > & {
    sectionSubtitle?: string | null;
    title?: string;
    apiPath?: DishDiscoveryRailSectionProps['apiPath'];
  },
) {
  const { sectionSubtitle = null, title, apiPath = '/dishes/featured', ...rest } = props;
  return (
    <DishDiscoveryRailSection
      {...rest}
      title={title ?? '🔥 Popular Dishes'}
      sectionSubtitle={sectionSubtitle}
      apiPath={apiPath}
      badgeMode="popular"
      mobileGridLayout
    />
  );
}

export function TrendingDishesSection(
  props: Omit<
    DishDiscoveryRailSectionProps,
    'title' | 'apiPath' | 'badgeMode' | 'sectionSubtitle'
  > & {
    sectionSubtitle?: string | null;
    title?: string;
    apiPath?: DishDiscoveryRailSectionProps['apiPath'];
  },
) {
  const { sectionSubtitle = null, title, apiPath = '/dishes/trending', ...rest } = props;
  return (
    <DishDiscoveryRailSection
      {...rest}
      title={title ?? '⚡ Trending Now'}
      sectionSubtitle={sectionSubtitle}
      apiPath={apiPath}
      badgeMode="trending"
      mobileGridLayout
    />
  );
}

export function NearbyDishesSection(
  props: Omit<
    DishDiscoveryRailSectionProps,
    'title' | 'apiPath' | 'badgeMode' | 'sectionSubtitle'
  > & { sectionSubtitle?: string | null },
) {
  const { sectionSubtitle, ...rest } = props;
  return (
    <DishDiscoveryRailSection
      {...rest}
      title="🍽 Dishes for you"
      sectionSubtitle={sectionSubtitle}
      apiPath="/dishes/nearby"
      badgeMode="popular"
    />
  );
}
