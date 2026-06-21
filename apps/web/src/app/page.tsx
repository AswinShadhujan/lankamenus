'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import api, { getAdminToken } from '@/lib/api';
import { Restaurant, District, type RestaurantsListResponse } from '@/types/restaurant';
import {
  HomeFiltersProvider,
  HomeDishesSectionLabel,
  HomeDishFilterRow,
  HomeRestaurantFilterRow,
  HomeRestaurantsSectionLabel,
  type HomeSortMode,
} from '@/components/home/HomeFilterBar';
import { HorizontalRestaurantSection } from '@/components/shared/HorizontalRestaurantSection';
import { PopularDishesSection, TrendingDishesSection } from '@/components/DishDiscoveryRailSection';
import { useDishFavourites } from '@/hooks/useDishFavourites';
import {
  parseCategoriesQueryParam,
  serializeCategoriesQuery,
} from '@/lib/foodCategories';
import { useHasMounted } from '@/hooks/useHasMounted';
import {
  isLocationResolved,
  runInitialGeolocation,
  type UserLocationState,
} from '@/lib/homeUserLocation';
import { buildHomeGeoQuery, mergeDistrictAndGeo } from '@/lib/homeLocationApi';
import { buildApiUrl } from '@/lib/buildApiUrl';

const DEFAULT_RADIUS_KM = 10;
const RAIL_PAGE_SIZE = 16;
const DISH_RAIL_CATEGORY_LIMIT = 10;

const SECTION_MB = 'mb-6';
export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasMounted = useHasMounted();
  /** After mount: matches URL (navbar). Before mount: empty so SSR matches first client paint. */
  /** Category filter from URL: `?categories=Kottu,Biryani` */
  const selectedCategories = useMemo(
    () =>
      hasMounted ? parseCategoriesQueryParam(searchParams?.get('categories')) : [],
    [hasMounted, searchParams],
  );

  const [popularRail, setPopularRail] = useState<Restaurant[]>([]);
  const [topRatedRail, setTopRatedRail] = useState<Restaurant[]>([]);
  const [trendingRail, setTrendingRail] = useState<Restaurant[]>([]);
  const [railsLoading, setRailsLoading] = useState(true);

  const [districts, setDistricts] = useState<District[]>([]);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  /** Single geolocation read on load — same coords for bias (default sorts) and strict Nearby. */
  const [userLocation, setUserLocation] = useState<UserLocationState>({ status: 'unknown' });
  const [locationError, setLocationError] = useState<string | null>(null);
  const [favouriteIds, setFavouriteIds] = useState<Set<number>>(new Set());
  const [favouriteLoadingId, setFavouriteLoadingId] = useState<number | null>(null);
  const [hasToken, setHasToken] = useState(false);

  const [selectedSort, setSelectedSort] = useState<HomeSortMode>('default');
  const [filterHighRating, setFilterHighRating] = useState(false);
  const [selectedDishCategory, setSelectedDishCategory] = useState<string | null>(null);
  const [nearMeGeoEnabled, setNearMeGeoEnabled] = useState(false);
  const [restaurantNearMeGeoEnabled, setRestaurantNearMeGeoEnabled] = useState(false);

  useEffect(() => {
    setHasToken(!!getAdminToken());
  }, []);

  useEffect(() => {
    runInitialGeolocation(setUserLocation);
  }, []);

  const locationReady = isLocationResolved(userLocation);
  const locationGranted = userLocation.status === 'granted';

  /** Bias by location after permission; strict radius when Near me is on. */
  const dishGeoQuery = useMemo(
    () =>
      locationGranted
        ? buildHomeGeoQuery(userLocation, nearMeGeoEnabled, DEFAULT_RADIUS_KM)
        : {},
    [userLocation, locationGranted, nearMeGeoEnabled],
  );

  const restaurantGeoQuery = useMemo(
    () =>
      locationGranted
        ? buildHomeGeoQuery(userLocation, restaurantNearMeGeoEnabled, DEFAULT_RADIUS_KM)
        : {},
    [userLocation, locationGranted, restaurantNearMeGeoEnabled],
  );

  /** Dish rails: location bias on load; stricter when dish Near me is on. */
  const homeDishDiscoveryQuery = dishGeoQuery;

  /** Restaurant rails: location bias on load; stricter when restaurant Near me is on. */
  const homeSharedQuery = useMemo(
    () => mergeDistrictAndGeo(selectedDistricts, restaurantGeoQuery),
    [selectedDistricts, restaurantGeoQuery],
  );

  const popularDishRailQuery = useMemo(() => {
    if (!selectedDishCategory) return homeDishDiscoveryQuery;
    return {
      ...homeDishDiscoveryQuery,
      category: selectedDishCategory,
      sort: 'popular',
      limit: DISH_RAIL_CATEGORY_LIMIT,
    };
  }, [homeDishDiscoveryQuery, selectedDishCategory]);

  const trendingDishRailQuery = useMemo(() => {
    if (!selectedDishCategory) return homeDishDiscoveryQuery;
    return {
      ...homeDishDiscoveryQuery,
      category: selectedDishCategory,
      sort: 'trending',
      limit: DISH_RAIL_CATEGORY_LIMIT,
    };
  }, [homeDishDiscoveryQuery, selectedDishCategory]);

  /** Restaurant discovery rails: shared geo/district + cuisine + pagination (sort per request). */
  const buildRailParams = useCallback((): Record<string, string | number> => {
    const base: Record<string, string | number> = { page: 1, limit: RAIL_PAGE_SIZE, ...homeSharedQuery };
    if (selectedCategories.length > 0) base.cuisine = selectedCategories.join(',');
    return base;
  }, [homeSharedQuery, selectedCategories]);

  const loadRails = useCallback(async () => {
    setRailsLoading(true);
    const base = buildRailParams();
    try {
      const railResults = await Promise.allSettled([
        fetch(buildApiUrl('/restaurants', { ...base, sort: 'popular' }), { cache: 'no-store' }).then((r) =>
          r.json() as Promise<RestaurantsListResponse>,
        ),
        fetch(buildApiUrl('/restaurants', { ...base, sort: 'top_rated' }), { cache: 'no-store' }).then((r) =>
          r.json() as Promise<RestaurantsListResponse>,
        ),
        fetch(buildApiUrl('/restaurants', { ...base, sort: 'trending' }), { cache: 'no-store' }).then((r) =>
          r.json() as Promise<RestaurantsListResponse>,
        ),
      ]);

      const pickData = (i: number) =>
        railResults[i].status === 'fulfilled'
          ? railResults[i].value.data ?? []
          : [];

      setPopularRail(pickData(0));
      setTopRatedRail(pickData(1));
      setTrendingRail(pickData(2));
    } finally {
      setRailsLoading(false);
    }
  }, [buildRailParams]);

  useEffect(() => {
    if (!locationReady) return;
    void loadRails();
  }, [locationReady, loadRails, homeSharedQuery, selectedSort]);

  useEffect(() => {
    fetch(buildApiUrl('/districts'), { cache: 'no-store' })
      .then((res) => res.json() as Promise<District[]>)
      .then((res) => setDistricts(res ?? []))
      .catch((err) => {
        if (process.env.NODE_ENV === 'development') console.error('Failed to load districts', err);
      });
  }, []);

  useEffect(() => {
    if (!hasToken) {
      setFavouriteIds(new Set());
      return;
    }
    api
      .get<{ data: Restaurant[] }>('/users/me/favourites')
      .then((res) => {
        const list = res.data.data ?? [];
        setFavouriteIds(new Set(list.map((r) => r.id)));
      })
      .catch(() => {});
  }, [hasToken]);

  const dishFavourites = useDishFavourites(hasToken);
  const dishFavouritesRail = useMemo(
    () => ({
      isFavourited: dishFavourites.isFavourited,
      onToggle: dishFavourites.toggle,
      loadingId: dishFavourites.loadingDishId,
    }),
    [dishFavourites.isFavourited, dishFavourites.toggle, dishFavourites.loadingDishId],
  );

  const handleToggleFavourite = (restaurant: Restaurant) => {
    if (!hasToken || favouriteLoadingId != null) return;
    const isFav = favouriteIds.has(restaurant.id);
    setFavouriteLoadingId(restaurant.id);
    if (isFav) {
      api
        .delete(`/users/me/favourites/${restaurant.id}`)
        .then(() =>
          setFavouriteIds((prev) => new Set([...prev].filter((id) => id !== restaurant.id))),
        )
        .catch(() => {})
        .finally(() => setFavouriteLoadingId(null));
    } else {
      api
        .post('/users/me/favourites', { restaurantId: restaurant.id })
        .then(() => setFavouriteIds((prev) => new Set([...prev, restaurant.id])))
        .catch(() => {})
        .finally(() => setFavouriteLoadingId(null));
    }
  };

  const setCategoriesInUrl = useCallback(
    (next: string[]) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      const serialized = serializeCategoriesQuery(next);
      if (serialized) params.set('categories', serialized);
      else params.delete('categories');
      const query = params.toString();
      router.replace(query ? `/?${query}` : '/', { scroll: false });
    },
    [router, searchParams],
  );

  const handleRequestLocation = useCallback((scope: 'dish' | 'restaurant') => {
    runInitialGeolocation((loc) => {
      setUserLocation(loc);
      if (loc.status === 'granted') {
        if (scope === 'restaurant') setRestaurantNearMeGeoEnabled(true);
        else setNearMeGeoEnabled(true);
        setLocationError(null);
        return;
      }
      if (loc.status === 'denied') {
        setLocationError(
          'Near me needs your location. Allow access in the browser, then try again — or use District.',
        );
      } else if (loc.status === 'unsupported') {
        setLocationError('This browser does not support location. Use District to narrow results.');
      } else if (loc.status === 'low_accuracy') {
        setLocationError(
          'Location is not accurate enough. Try a device with GPS, or browse by district.',
        );
      }
    });
  }, []);

  const handleRestaurantFiltersApply = useCallback(
    (sort: HomeSortMode, highRating: boolean, categories: string[]) => {
      setLocationError(null);
      setSelectedSort(sort);
      setFilterHighRating(highRating);
      setCategoriesInUrl(categories);
    },
    [setCategoriesInUrl],
  );

  const handleDishCategoryApply = useCallback((category: string | null) => {
    setSelectedDishCategory(category);
  }, []);

  const handleDistrictApply = useCallback((districts: string[]) => {
    setSelectedDistricts(districts);
  }, []);

  return (
    <>
    <main className="mx-auto w-full max-w-none px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom,0px))] sm:px-6 sm:pt-3 sm:pb-6 lg:px-8 xl:px-10">
      <HomeFiltersProvider
        nearMeGeoEnabled={nearMeGeoEnabled}
        onNearMeGeoChange={setNearMeGeoEnabled}
        restaurantNearMeGeoEnabled={restaurantNearMeGeoEnabled}
        onRestaurantNearMeGeoChange={setRestaurantNearMeGeoEnabled}
        userLocation={userLocation}
        onRequestLocation={handleRequestLocation}
        selectedDishCategory={selectedDishCategory}
        onDishCategoryApply={handleDishCategoryApply}
        selectedSort={selectedSort}
        filterHighRating={filterHighRating}
        onRestaurantFiltersApply={handleRestaurantFiltersApply}
        selectedCategories={selectedCategories}
        districts={districts}
        selectedDistricts={selectedDistricts}
        onDistrictApply={handleDistrictApply}
      >
        <HomeDishesSectionLabel />
        <HomeDishFilterRow />

      {locationError && (
        <p
          className={`${SECTION_MB} rounded-md border px-3 py-2 text-sm`}
          role="alert"
          style={{
            borderColor: 'color-mix(in srgb, var(--border) 80%, transparent)',
            color: 'var(--text-primary)',
          }}
        >
          {locationError}
        </p>
      )}

      <section className={`${SECTION_MB} space-y-6`}>
        <PopularDishesSection
          locationReady={locationReady}
          apiPath={selectedDishCategory ? '/dishes' : '/dishes/featured'}
          apiQuery={popularDishRailQuery}
          title={
            selectedDishCategory ? `🔥 Popular ${selectedDishCategory}` : undefined
          }
          dishFavourites={dishFavouritesRail}
        />
        <TrendingDishesSection
          locationReady={locationReady}
          apiPath={selectedDishCategory ? '/dishes' : '/dishes/trending'}
          apiQuery={trendingDishRailQuery}
          title={
            selectedDishCategory ? `⚡ Trending ${selectedDishCategory}` : undefined
          }
          dishFavourites={dishFavouritesRail}
        />
      </section>

        <div
          className={`${SECTION_MB} border-t pt-6`}
          style={{ borderColor: 'color-mix(in srgb, var(--border) 55%, transparent)' }}
        >
          <HomeRestaurantsSectionLabel />
          <HomeRestaurantFilterRow />
        </div>

      <section className={`${SECTION_MB} space-y-6`}>
        <HorizontalRestaurantSection
          title="🔥 Popular"
          restaurants={popularRail}
          maxItems={RAIL_PAGE_SIZE}
          isLoading={railsLoading}
          mobileGridLayout
          seeAllHref="/restaurants"
          hasToken={hasToken}
          favouriteIds={favouriteIds}
          favouriteLoadingId={favouriteLoadingId}
          onFavoriteClick={handleToggleFavourite}
        />
        <HorizontalRestaurantSection
          title="⭐ Top Rated"
          restaurants={topRatedRail}
          maxItems={RAIL_PAGE_SIZE}
          isLoading={railsLoading}
          mobileGridLayout
          seeAllHref="/restaurants"
          hasToken={hasToken}
          favouriteIds={favouriteIds}
          favouriteLoadingId={favouriteLoadingId}
          onFavoriteClick={handleToggleFavourite}
        />
        <HorizontalRestaurantSection
          title="⚡ Trending"
          restaurants={trendingRail}
          maxItems={RAIL_PAGE_SIZE}
          isLoading={railsLoading}
          mobileGridLayout
          seeAllHref="/restaurants"
          hasToken={hasToken}
          favouriteIds={favouriteIds}
          favouriteLoadingId={favouriteLoadingId}
          onFavoriteClick={handleToggleFavourite}
        />
      </section>

      </HomeFiltersProvider>

      <div className="text-center" style={{ padding: '1.5rem 0' }}>
        <Link
          href="/restaurants"
          className="inline-block text-xs font-medium transition-opacity hover:opacity-80 sm:text-sm"
          style={{ color: 'var(--text-secondary)' }}
        >
          Browse all restaurants →
        </Link>
      </div>

    </main>
    </>
  );
}
