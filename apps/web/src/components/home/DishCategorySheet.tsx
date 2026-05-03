'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getApiBaseUrl, resolvePublicMediaUrl } from '@/lib/api';
import type { UserLocationState } from '@/lib/homeUserLocation';
import type { DishDiscoveryItem } from '@/types/featuredDish';
import type { Restaurant, RestaurantsListResponse } from '@/types/restaurant';
import { RestaurantCard } from '@/components/ui/RestaurantCard';
import { HorizontalScroll } from '@/components/ui/HorizontalScroll';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';
import { DishFavoriteButton } from '@/components/ui/DishFavoriteButton';
import type { DishRailFavouritesProps } from '@/components/DishDiscoveryRailSection';

export type DishCategorySheetProps = {
  category: string | null;
  onClose: () => void;
  userLocation: UserLocationState;
  selectedDistricts: string[];
  dishFavourites?: DishRailFavouritesProps | null;
};

function buildApiUrl(path: string, params?: Record<string, string | number>): string {
  const base = (getApiBaseUrl() || (typeof window !== 'undefined' ? window.location.origin : '')).replace(
    /\/$/,
    '',
  );
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

function SheetDishCard({
  dish,
  dishFavourites,
}: {
  dish: DishDiscoveryItem;
  dishFavourites?: DishRailFavouritesProps | null;
}) {
  const priceStr = formatPrice(dish.price, dish.currency);
  const img = resolvePublicMediaUrl(dish.image_url);
  return (
    <Link
      href={dishHref(dish)}
      className="lm-card-shadow group flex min-h-0 flex-col overflow-hidden rounded-2xl border outline-none transition-all active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent-primary)_55%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
    >
      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-[var(--border)]">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote dish URLs
          <img
            src={img}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl opacity-40" aria-hidden>
            🍽
          </div>
        )}
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
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 p-2.5">
        <p className="line-clamp-2 text-sm font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
          {dish.name}
        </p>
        {priceStr ? (
          <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            {priceStr}
          </p>
        ) : null}
        <p className="mt-auto line-clamp-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {dish.restaurant.name}
        </p>
      </div>
    </Link>
  );
}

function DishGridSkeleton() {
  return (
    <ul className="grid grid-cols-2 gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="min-h-0">
          <div
            className="lm-card-shadow overflow-hidden rounded-2xl border"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
          >
            <Skeleton className="aspect-[4/3] w-full rounded-none" />
            <div className="space-y-2 p-2.5">
              <Skeleton className="h-3.5 w-[88%]" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-[70%]" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function RestaurantRailSkeleton() {
  return (
    <HorizontalScroll className="pb-1">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex w-[min(326px,calc(100vw-5rem))] shrink-0 snap-start flex-col sm:w-[336px]"
        >
          <SkeletonCard variant="rail" className="w-full" />
        </div>
      ))}
    </HorizontalScroll>
  );
}

export function DishCategorySheet({
  category,
  onClose,
  userLocation,
  selectedDistricts,
  dishFavourites = null,
}: DishCategorySheetProps) {
  const [entered, setEntered] = useState(false);
  const [dishesLoading, setDishesLoading] = useState(false);
  const [restaurantsLoading, setRestaurantsLoading] = useState(false);
  const [dishes, setDishes] = useState<DishDiscoveryItem[] | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[] | null>(null);

  const districtCsv = selectedDistricts.length > 0 ? selectedDistricts.join(',') : '';

  const loadData = useCallback(() => {
    if (!category) return;
    setDishes(null);
    setRestaurants(null);
    setDishesLoading(true);
    setRestaurantsLoading(true);

    const geoParams: Record<string, string | number> =
      userLocation.status === 'granted'
        ? { lat: userLocation.lat, lng: userLocation.lng, radius_km: 10 }
        : {};

    const dishParams: Record<string, string | number> = {
      category,
      limit: 20,
      ...geoParams,
    };
    if (districtCsv) dishParams.district = districtCsv;

    const restaurantParams: Record<string, string | number> = {
      dish_category: category,
      limit: 8,
      page: 1,
      ...geoParams,
    };
    if (districtCsv) restaurantParams.district = districtCsv;

    const dishUrl = buildApiUrl('/dishes/search', dishParams);
    const restaurantUrl = buildApiUrl('/restaurants', restaurantParams);

    fetch(dishUrl, { cache: 'no-store' })
      .then(async (res) => {
        const data: unknown = await res.json().catch(() => null);
        if (!Array.isArray(data)) return [];
        return data as DishDiscoveryItem[];
      })
      .then((rows) => setDishes(rows))
      .catch(() => setDishes([]))
      .finally(() => setDishesLoading(false));

    fetch(restaurantUrl, { cache: 'no-store' })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as RestaurantsListResponse | null;
        return data?.data ?? [];
      })
      .then((rows) => setRestaurants(rows))
      .catch(() => setRestaurants([]))
      .finally(() => setRestaurantsLoading(false));
  }, [category, districtCsv, userLocation]);

  useEffect(() => {
    if (!category) {
      setEntered(false);
      return;
    }
    setEntered(false);
    loadData();
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setEntered(true));
    });
    return () => window.cancelAnimationFrame(id);
  }, [category, loadData]);

  useEffect(() => {
    if (!category) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [category]);

  if (!category) return null;

  const subtitle =
    selectedDistricts.length > 0 ? selectedDistricts.join(', ') : 'Menus across Sri Lanka';

  const loading = dishesLoading || restaurantsLoading;
  const dishList = dishes ?? [];
  const restList = restaurants ?? [];
  const empty = !loading && dishList.length === 0 && restList.length === 0;

  return (
    <div className="fixed inset-0 z-[85] flex flex-col justify-end sm:items-center sm:justify-center sm:p-4">
      <button
        type="button"
        aria-label="Close"
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ease-out ${
          entered ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dish-category-sheet-title"
        className={`relative z-[1] flex w-full flex-col overflow-hidden rounded-t-3xl shadow-xl transition-[transform,opacity] duration-300 ease-out sm:max-h-[80vh] sm:max-w-[640px] sm:rounded-3xl ${
          entered
            ? 'pointer-events-auto max-h-[85dvh] translate-y-0 opacity-100 sm:translate-y-0'
            : 'pointer-events-none max-h-[85dvh] translate-y-full opacity-100 sm:translate-y-6 sm:opacity-0'
        }`}
        style={{ backgroundColor: 'var(--surface)' }}
      >
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 flex-col items-center border-b px-4 pb-3 pt-2 sm:flex-row sm:items-start sm:px-5 sm:pb-4 sm:pt-5" style={{ borderColor: 'var(--border)' }}>
            <div
              className="mb-2 shrink-0 rounded-full sm:hidden"
              style={{
                width: '40px',
                height: '4px',
                backgroundColor: 'var(--border)',
              }}
              aria-hidden
            />
            <div className="min-w-0 flex-1 pr-10 text-center sm:pr-12 sm:text-left">
              <h2
                id="dish-category-sheet-title"
                className="text-lg font-semibold leading-snug sm:text-xl"
                style={{ color: 'var(--text-primary)' }}
              >
                {category} near you
              </h2>
              <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {subtitle}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="absolute right-1 top-2 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-lg leading-none transition-opacity hover:opacity-80 sm:right-3 sm:top-3"
              style={{ color: 'var(--text-primary)' }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 sm:px-5 sm:pb-6">
            {loading ? (
              <>
                <DishGridSkeleton />
                <p className="mb-2 mt-6 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Restaurants serving {category}
                </p>
                <RestaurantRailSkeleton />
              </>
            ) : empty ? (
              <p className="py-12 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                No results found
              </p>
            ) : (
              <>
                {dishList.length > 0 ? (
                  <ul className="grid grid-cols-2 gap-2">
                    {dishList.map((d) => (
                      <li key={`${d.restaurant.id}-${d.menu_id}-${d.id}`} className="min-h-0">
                        <SheetDishCard dish={d} dishFavourites={dishFavourites} />
                      </li>
                    ))}
                  </ul>
                ) : null}

                <h3 className="mb-2 mt-6 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Restaurants serving {category}
                </h3>
                {restList.length > 0 ? (
                  <HorizontalScroll className="pb-1">
                    {restList.map((r) => (
                      <div key={r.id} className="w-[min(336px,calc(100vw-2rem))] shrink-0">
                        <RestaurantCard restaurant={r} variant="rail" showFavorite={false} className="w-full" />
                      </div>
                    ))}
                  </HorizontalScroll>
                ) : (
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    No restaurants in this list.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
