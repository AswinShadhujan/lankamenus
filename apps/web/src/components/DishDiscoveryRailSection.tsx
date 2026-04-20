'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getApiBaseUrl, resolvePublicMediaUrl } from '@/lib/api';
import type { DishDiscoveryItem } from '@/types/featuredDish';
import { HorizontalScroll } from '@/components/ui/HorizontalScroll';
import { useHasMounted } from '@/hooks/useHasMounted';
import { HomeSectionHeader } from '@/components/home/HomeSectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';

export type DishDiscoveryRailSectionProps = {
  title: string;
  sectionSubtitle?: string | null;
  apiPath: '/dishes/featured' | '/dishes/trending' | '/dishes/nearby';
  /** Initial geolocation attempt finished (any outcome). */
  locationReady: boolean;
  /**
   * Same `district` + geo keys as restaurant rails (`homeSharedQuery` from the homepage).
   */
  apiQuery: Record<string, string | number>;
  locationLabel?: string | null;
  badgeMode: 'popular' | 'trending';
  onSeeAll?: () => void;
};

function dishQueryHasScope(q: Record<string, string | number>): boolean {
  const d = q.district;
  if (typeof d === 'string' && d.trim() !== '') return true;
  return q.lat != null;
}

function buildApiUrl(path: string, params?: Record<string, string | number>): string {
  const base = (getApiBaseUrl() || window.location.origin).replace(/\/$/, '');
  const url = new URL(path, `${base}/`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      if (typeof v === 'number' && !Number.isFinite(v)) continue;
      url.searchParams.set(k, String(v));
    }
  }
  url.searchParams.set('_ts', String(Date.now()));
  return url.toString();
}

function formatPrice(price: number | null, currency: string): string | null {
  if (price == null) return null;
  const c = currency.trim().toUpperCase() || 'LKR';
  return `${c} ${price.toFixed(2)}`;
}

function dishHref(d: DishDiscoveryItem): string {
  return `/restaurants/${d.restaurant.id}/menus/${d.menu_id}/items/${d.id}`;
}

function PopularImageBadge() {
  return (
    <div className="absolute right-2 top-2 rounded-full bg-orange-500/90 px-2 py-1 text-xs font-medium text-white shadow-md">
      🔥 Popular
    </div>
  );
}

function TrendingImageBadge() {
  return (
    <div className="absolute right-2 top-2 animate-pulse rounded-full bg-blue-500/90 px-2 py-1 text-xs font-medium text-white shadow-md">
      ⚡ Trending
    </div>
  );
}

function DishDiscoverySkeletonRow() {
  return (
    <HorizontalScroll>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="w-[260px] shrink-0 snap-start">
          <div
            className="overflow-hidden rounded-2xl border shadow-md"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
          >
            <Skeleton className="h-[160px] w-full rounded-none" />
            <div className="space-y-2 p-3">
              <Skeleton className="h-4 w-[90%]" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-3 w-[70%]" />
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
}: DishDiscoveryRailSectionProps) {
  const hasMounted = useHasMounted();
  const [dishes, setDishes] = useState<DishDiscoveryItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasMounted || !locationReady) return;
    let cancelled = false;
    setLoading(true);

    const dishUrl = buildApiUrl(apiPath, apiQuery);

    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console -- temporary dish request trace
      console.log('[dish rail fetch]', apiPath, dishUrl);
    }

    fetch(dishUrl, { cache: 'no-store' })
      .then(async (res) => {
        const data: unknown = await res.json().catch(() => null);
        if (!Array.isArray(data)) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[DishDiscoveryRail]', apiPath, 'not array', res.status, data);
          }
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
        />
        <p className="mt-2 max-w-xl text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {emptyCopy}
        </p>
      </section>
    );
  }

  const imageBadge = badgeMode === 'popular' ? <PopularImageBadge /> : <TrendingImageBadge />;

  return (
    <section className="scroll-mt-4" aria-busy={loading}>
      <HomeSectionHeader
        title={title}
        subtitle={sectionSubtitle}
        meta={locationLabel}
        onSeeAll={onSeeAll}
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
          <DishDiscoverySkeletonRow />
        </div>

        {!loading && dishes && dishes.length > 0 ? (
          <div className="relative z-[2] transition-opacity duration-200 ease-out lm-fade-in opacity-100">
            <HorizontalScroll>
              {dishes.map((d) => {
                const href = dishHref(d);
                const priceStr = formatPrice(d.price, d.currency);
                const img = resolvePublicMediaUrl(d.image_url);

                return (
                  <div
                    key={`${d.restaurant.id}-${d.menu_id}-${d.id}`}
                    className="w-[260px] shrink-0 snap-start"
                  >
                    <Link
                      href={href}
                      className="group relative block overflow-hidden rounded-2xl border shadow-md outline-none transition-all duration-300 hover:scale-[1.03] hover:shadow-xl focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
                      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
                    >
                      <div className="relative h-[160px] overflow-hidden">
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element -- remote dish URLs
                          <img
                            src={img}
                            alt={d.name}
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
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                        {imageBadge}
                      </div>
                      <div className="space-y-1 p-3">
                        <h3
                          className="line-clamp-2 text-sm font-medium leading-tight"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {d.name}
                        </h3>
                        {priceStr != null ? (
                          <p className="text-sm font-semibold" style={{ color: 'var(--accent-secondary)' }}>
                            {priceStr}
                          </p>
                        ) : null}
                        <p className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {d.restaurant.name}
                        </p>
                      </div>
                    </Link>
                  </div>
                );
              })}
            </HorizontalScroll>
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
  >,
) {
  return (
    <DishDiscoveryRailSection
      {...props}
      title="🔥 Popular Dishes"
      sectionSubtitle="Standout picks from menus"
      apiPath="/dishes/featured"
      badgeMode="popular"
    />
  );
}

export function TrendingDishesSection(
  props: Omit<
    DishDiscoveryRailSectionProps,
    'title' | 'apiPath' | 'badgeMode' | 'sectionSubtitle'
  >,
) {
  return (
    <DishDiscoveryRailSection
      {...props}
      title="⚡ Trending Now"
      sectionSubtitle="Getting noticed on menus"
      apiPath="/dishes/trending"
      badgeMode="trending"
    />
  );
}

export function NearbyDishesSection(
  props: Omit<
    DishDiscoveryRailSectionProps,
    'title' | 'apiPath' | 'badgeMode' | 'sectionSubtitle'
  >,
) {
  return (
    <DishDiscoveryRailSection
      {...props}
      title="🍽 Dishes for you"
      sectionSubtitle="Matching your selected categories"
      apiPath="/dishes/nearby"
      badgeMode="popular"
    />
  );
}
