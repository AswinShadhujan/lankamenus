'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api, { getAdminToken } from '@/lib/api';
import { Restaurant, District } from '@/types/restaurant';
import { HomeFilterBar, type HomeSortMode } from '@/components/home/HomeFilterBar';
import { AllRestaurantsGrid } from '@/components/home/AllRestaurantsGrid';
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
const RATING_THRESHOLD = 4.5;

export default function RestaurantsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasMounted = useHasMounted();
  const urlQuery = hasMounted ? (searchParams?.get('q') ?? '') : '';
  const selectedCategories = useMemo(
    () =>
      hasMounted ? parseCategoriesQueryParam(searchParams?.get('categories')) : [],
    [hasMounted, searchParams],
  );

  const [districts, setDistricts] = useState<District[]>([]);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [userLocation, setUserLocation] = useState<UserLocationState>({ status: 'unknown' });
  const [locationError, setLocationError] = useState<string | null>(null);
  const [favouriteIds, setFavouriteIds] = useState<Set<number>>(new Set());
  const [favouriteLoadingId, setFavouriteLoadingId] = useState<number | null>(null);
  const [hasToken, setHasToken] = useState(false);

  const [selectedSort, setSelectedSort] = useState<HomeSortMode>('default');
  const [filterHighRating, setFilterHighRating] = useState(false);
  const [nearMeGeoEnabled, setNearMeGeoEnabled] = useState(false);

  useEffect(() => {
    setHasToken(!!getAdminToken());
  }, []);

  useEffect(() => {
    runInitialGeolocation(setUserLocation);
  }, []);

  const locationReady = isLocationResolved(userLocation);
  const locationGranted = userLocation.status === 'granted';

  const geoForApi = useMemo(
    () =>
      locationGranted
        ? buildHomeGeoQuery(userLocation, nearMeGeoEnabled, DEFAULT_RADIUS_KM)
        : {},
    [userLocation, locationGranted, nearMeGeoEnabled],
  );

  const homeSharedQuery = useMemo(
    () => mergeDistrictAndGeo(selectedDistricts, geoForApi),
    [selectedDistricts, geoForApi],
  );

  const buildListParams = useCallback(() => {
    const params: Record<string, string | number> = { ...homeSharedQuery };
    const q = urlQuery.trim();
    if (q) params.q = q;
    if (selectedCategories.length > 0) params.cuisine = selectedCategories.join(',');
    if (selectedSort === 'popular') params.sort = 'popular';
    else if (selectedSort === 'top_rated') params.sort = 'top_rated';
    else if (selectedSort === 'trending') params.sort = 'trending';
    return params;
  }, [homeSharedQuery, urlQuery, selectedCategories, selectedSort]);

  useEffect(() => {
    fetch(buildApiUrl('/districts'), { cache: 'no-store' })
      .then((res) => res.json() as Promise<District[]>)
      .then((res) => setDistricts(res ?? []))
      .catch(() => {});
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

  const setCategoriesInUrl = useCallback(
    (next: string[]) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      const serialized = serializeCategoriesQuery(next);
      if (serialized) params.set('categories', serialized);
      else params.delete('categories');
      const query = params.toString();
      router.replace(query ? `/restaurants?${query}` : '/restaurants', { scroll: false });
    },
    [router, searchParams],
  );

  const handleRequestLocation = useCallback((_scope: 'dish' | 'restaurant') => {
    runInitialGeolocation((loc) => {
      setUserLocation(loc);
      if (loc.status === 'granted') {
        setNearMeGeoEnabled(true);
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

  const handleDistrictApply = useCallback((districtsList: string[]) => {
    setSelectedDistricts(districtsList);
  }, []);

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

  const clearAllFilters = () => {
    setSelectedSort('default');
    setSelectedDistricts([]);
    setFilterHighRating(false);
    setNearMeGeoEnabled(false);
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.delete('categories');
    params.delete('q');
    const query = params.toString();
    router.replace(query ? `/restaurants?${query}` : '/restaurants', { scroll: false });
  };

  const emptyDescription =
    filterHighRating
      ? 'No restaurants match your ⭐ 4.5+ filter. Try clearing filters or adjusting search.'
      : 'Try a different search, filters, or sort.';

  return (
    <main className="mx-auto w-full max-w-none px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom,0px))] sm:px-6 sm:pt-3 sm:pb-6 lg:px-8 xl:px-10">
      <h1
        className="mb-4 text-xl font-semibold tracking-tight sm:text-2xl"
        style={{ color: 'var(--text-primary)' }}
      >
        All Restaurants
      </h1>

      <HomeFilterBar
        showDishType={false}
        nearMeGeoEnabled={nearMeGeoEnabled}
        onNearMeGeoChange={setNearMeGeoEnabled}
        userLocation={userLocation}
        onRequestLocation={handleRequestLocation}
        selectedDishCategory={null}
        onDishCategoryApply={() => {}}
        selectedSort={selectedSort}
        filterHighRating={filterHighRating}
        onRestaurantFiltersApply={handleRestaurantFiltersApply}
        selectedCategories={selectedCategories}
        districts={districts}
        selectedDistricts={selectedDistricts}
        onDistrictApply={handleDistrictApply}
      />

      {locationError ? (
        <p
          className="mb-4 rounded-md border px-3 py-2 text-sm"
          role="alert"
          style={{
            borderColor: 'color-mix(in srgb, var(--border) 80%, transparent)',
            color: 'var(--text-primary)',
          }}
        >
          {locationError}
        </p>
      ) : null}

      <AllRestaurantsGrid
        buildListParams={buildListParams}
        locationReady={locationReady}
        filterHighRating={filterHighRating}
        hasToken={hasToken}
        favouriteIds={favouriteIds}
        favouriteLoadingId={favouriteLoadingId}
        onFavoriteClick={handleToggleFavourite}
        emptyDescription={emptyDescription}
        onClearFilters={clearAllFilters}
      />
    </main>
  );
}
