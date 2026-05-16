'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { resolvePublicMediaUrl } from '@/lib/api';
import { buildApiUrl } from '@/lib/buildApiUrl';
import type { DishDiscoveryItem } from '@/types/featuredDish';
import { HorizontalScroll } from '@/components/ui/HorizontalScroll';
import { useHasMounted } from '@/hooks/useHasMounted';
import { HomeSectionHeader } from '@/components/home/HomeSectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { DishFavoriteButton } from '@/components/ui/DishFavoriteButton';

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

const MOBILE_DISH_COUNT = 4;
const DESKTOP_DISH_COUNT = 5;

function dishQueryHasScope(q: Record<string, string | number>): boolean {
  const d = q.district;
  if (typeof d === 'string' && d.trim() !== '') return true;
  if (q.lat != null) return true;
  const cat = q.category;
  if (typeof cat === 'string' && cat.trim() !== '') return true;
  return false;
}

function formatPrice(price: number | null, currency: string): string | null {
  if (price == null) return null;
  const c = currency.trim().toUpperCase() || 'LKR';
  return `${c} ${price.toFixed(2)}`;
}

function dishHref(d: DishDiscoveryItem): string {
  return `/restaurants/${d.restaurant.id}/menus/${d.menu_id}/items/${d.id}`;
}

function DishDiscoveryCard({
  dish,
  imageBadge,
  dishFavourites,
  className = '',
}: {
  dish: DishDiscoveryItem;
  imageBadge: ReactNode;
  dishFavourites: DishRailFavouritesProps | null;
  className?: string;
}) {
  const href = dishHref(dish);
  const priceStr = formatPrice(dish.price, dish.currency);
  const img = resolvePublicMediaUrl(dish.image_url);

  return (
    <Link
      href={href}
      className={`lm-card-shadow group relative block w-full overflow-hidden rounded-2xl border outline-none transition-[transform,box-shadow] duration-200 active:scale-[0.99] hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent-primary)_55%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] ${className}`}
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
    >
      <div className="relative h-[140px] overflow-hidden md:h-[160px]">
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
            style={{ backgroundColor: 'var(--border)' }}
            aria-hidden
          >
            🍽
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" aria-hidden />
        {imageBadge}
        {dishFavourites ? (
          <div
            className="absolute right-2 top-2 z-[2]"
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
      <div className="space-y-1 p-3">
        <h3
          className="line-clamp-2 text-sm font-medium leading-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          {dish.name}
        </h3>
        {priceStr != null ? (
          <p className="text-sm font-semibold" style={{ color: 'var(--accent-secondary)' }}>
            {priceStr}
          </p>
        ) : null}
        <p className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
          {dish.restaurant.name}
        </p>
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

const DISH_CARD_WIDTH = 'w-[min(312px,calc(100vw-2.75rem))] shrink-0 snap-start';

function DishCardSkeleton() {
  return (
    <div
      className="lm-card-shadow overflow-hidden rounded-2xl border"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
    >
      <Skeleton className="h-[140px] w-full rounded-none md:h-[160px]" />
      <div className="space-y-1 p-3">
        <Skeleton className="min-h-[2.25rem] w-[94%] rounded-md" />
        <Skeleton className="h-[1.125rem] w-20 rounded-md" />
        <Skeleton className="h-[0.875rem] w-[78%] rounded-md" />
      </div>
    </div>
  );
}

function DishDiscoverySkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 md:hidden">
      {Array.from({ length: MOBILE_DISH_COUNT }).map((_, i) => (
        <DishCardSkeleton key={i} />
      ))}
    </div>
  );
}

function DishDiscoverySkeletonRow() {
  return (
    <HorizontalScroll>
      {Array.from({ length: DESKTOP_DISH_COUNT }).map((_, i) => (
        <div key={i} className={DISH_CARD_WIDTH}>
          <div
            className="lm-card-shadow overflow-hidden rounded-2xl border"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
          >
            <Skeleton className="h-[160px] w-full rounded-none" />
            <div className="space-y-1 p-3">
              <Skeleton className="min-h-[2.25rem] w-[94%] rounded-md" />
              <Skeleton className="h-[1.125rem] w-20 rounded-md" />
              <Skeleton className="h-[0.875rem] w-[78%] rounded-md" />
            </div>
          </div>
        </div>
      ))}
    </HorizontalScroll>
  );
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
  const mobileDishes = (dishes ?? []).slice(0, MOBILE_DISH_COUNT);
  const desktopDishes = (dishes ?? []).slice(0, DESKTOP_DISH_COUNT);

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
            <>
              <DishDiscoverySkeletonGrid />
              <div className="hidden md:block">
                <DishDiscoverySkeletonRow />
              </div>
            </>
          ) : (
            <DishDiscoverySkeletonRow />
          )}
        </div>

        {!loading && dishes && dishes.length > 0 ? (
          <div className="relative z-[2] transition-opacity duration-200 ease-out lm-fade-in opacity-100">
            {mobileGridLayout ? (
              <>
                <div className="grid grid-cols-2 gap-3 md:hidden">
                  {mobileDishes.map((d) => (
                    <DishDiscoveryCard
                      key={`${d.restaurant.id}-${d.menu_id}-${d.id}-m`}
                      dish={d}
                      imageBadge={imageBadge}
                      dishFavourites={dishFavourites}
                    />
                  ))}
                </div>
                <div className="hidden gap-4 overflow-x-auto hide-scrollbar md:flex [-webkit-overflow-scrolling:touch]">
                  {desktopDishes.map((d) => (
                    <div key={`${d.restaurant.id}-${d.menu_id}-${d.id}-d`} className={DISH_CARD_WIDTH}>
                      <DishDiscoveryCard
                        dish={d}
                        imageBadge={imageBadge}
                        dishFavourites={dishFavourites}
                      />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <HorizontalScroll>
                {dishes.map((d) => (
                  <div
                    key={`${d.restaurant.id}-${d.menu_id}-${d.id}`}
                    className={DISH_CARD_WIDTH}
                  >
                    <DishDiscoveryCard
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
