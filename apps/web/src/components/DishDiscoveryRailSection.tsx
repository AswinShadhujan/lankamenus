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
  apiPath: '/dishes/featured' | '/dishes/trending';
  geoResolved: boolean;
  nearMeCoords: { lat: number; lng: number; radius_km: number } | null;
  /**
   * Comma-separated district names when not using `nearMeCoords` — same `district` query as GET /restaurants.
   */
  districtCsv?: string | null;
  /** Dev-only: resolved district ids for logging (homepage maps names → ids). */
  districtIdsForDebug?: string[];
  /** True while Nearby is fetching a fresh fix — do not call dish APIs with stale/missing coords. */
  deferGeoFetch?: boolean;
  locationLabel?: string | null;
  badgeMode: 'popular' | 'trending';
  onSeeAll?: () => void;
};

function buildApiUrl(path: string, params?: Record<string, string | number>): string {
  const base = (getApiBaseUrl() || window.location.origin).replace(/\/$/, '');
  const url = new URL(path, `${base}/`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
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
          <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#111] shadow-md">
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
  geoResolved,
  nearMeCoords,
  districtCsv = null,
  districtIdsForDebug,
  deferGeoFetch = false,
  locationLabel = null,
  badgeMode,
  onSeeAll,
}: DishDiscoveryRailSectionProps) {
  const hasMounted = useHasMounted();
  const [dishes, setDishes] = useState<DishDiscoveryItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasMounted || !geoResolved) return;
    if (deferGeoFetch) {
      setLoading(true);
      return;
    }
    let cancelled = false;
    setLoading(true);

    const params: Record<string, string | number> = {};
    if (nearMeCoords) {
      params.lat = nearMeCoords.lat;
      params.lng = nearMeCoords.lng;
      params.radius_km = nearMeCoords.radius_km;
    } else if (districtCsv && districtCsv.trim() !== '') {
      params.district = districtCsv;
    }

    const dishUrl = buildApiUrl(apiPath, params);

    if (process.env.NODE_ENV === 'development') {
      // Temporary: trace dish scope vs homepage district selection.
      console.log('[lm:dish-district-debug]', apiPath, {
        districtNames: districtCsv ?? null,
        districtIds: districtIdsForDebug ?? [],
        finalUrl: dishUrl,
      });
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
  }, [
    apiPath,
    hasMounted,
    geoResolved,
    deferGeoFetch,
    districtCsv,
    nearMeCoords?.lat,
    nearMeCoords?.lng,
    nearMeCoords?.radius_km,
  ]);

  if (!hasMounted || !geoResolved) {
    return null;
  }

  const hasLocationScope =
    (districtCsv != null && districtCsv.trim() !== '') || nearMeCoords != null;

  if (!loading && (!dishes || dishes.length === 0)) {
    if (!hasLocationScope) {
      return null;
    }
    const emptyCopy = nearMeCoords
      ? 'No dishes in this area yet. Try a different location or browse by district.'
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
                      className="group relative block overflow-hidden rounded-2xl border border-white/5 bg-[#111] shadow-md outline-none transition-all duration-300 hover:scale-[1.03] hover:shadow-xl focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
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
                            className="flex h-full w-full items-center justify-center bg-neutral-800 text-3xl opacity-50"
                            aria-hidden
                          >
                            🍽
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                        {imageBadge}
                      </div>
                      <div className="space-y-1 p-3">
                        <h3 className="line-clamp-2 text-sm font-medium leading-tight text-white">
                          {d.name}
                        </h3>
                        {priceStr != null ? (
                          <p className="text-sm font-semibold text-orange-400">{priceStr}</p>
                        ) : null}
                        <p className="truncate text-xs text-gray-400">{d.restaurant.name}</p>
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
      sectionSubtitle="Customer favourites"
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
      sectionSubtitle="Hot right now"
      apiPath="/dishes/trending"
      badgeMode="trending"
    />
  );
}
