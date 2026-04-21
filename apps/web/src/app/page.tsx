'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import api, { getAdminToken, getApiBaseUrl } from '@/lib/api';
import { Restaurant, District, type RestaurantsListResponse } from '@/types/restaurant';
import { RestaurantCard } from '@/components/ui/RestaurantCard';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { HomeSectionHeader } from '@/components/home/HomeSectionHeader';
import { HomeCategoryStrip } from '@/components/home/HomeCategoryStrip';
import { UberEatsPill } from '@/components/ui/UberEatsPill';
import { HorizontalRestaurantSection } from '@/components/shared/HorizontalRestaurantSection';
import {
  PopularDishesSection,
  TrendingDishesSection,
  NearbyDishesSection,
} from '@/components/DishDiscoveryRailSection';
import { useIntersectionLoadMore } from '@/hooks/useIntersectionLoadMore';
import { getLocationLabel } from '@/lib/getLocationLabel';
import {
  parseCategoriesQueryParam,
  serializeCategoriesQuery,
} from '@/lib/foodCategories';
import { useHasMounted } from '@/hooks/useHasMounted';
import {
  clearStoredNearbyGeoMeta,
  persistNearbyGeoMetaAfterSuccess,
} from '@/lib/geolocationFresh';
import {
  isLocationResolved,
  MAX_ACCEPTABLE_ACCURACY_METERS,
  runInitialGeolocation,
  type UserLocationState,
} from '@/lib/homeUserLocation';
import { buildHomeGeoQuery, mergeDistrictAndGeo } from '@/lib/homeLocationApi';

const DEFAULT_RADIUS_KM = 10;
/** Strict radius for category-driven dish rail only (does not change restaurant grid / rails). */
const CATEGORY_NEARBY_DISH_RADIUS_KM = 5;

const NEARBY_UNSUPPORTED_MESSAGE =
  'This browser does not support location. Use District to narrow results.';
const RATING_THRESHOLD = 4.5;
const GRID_PAGE_SIZE = 12;
const RAIL_PAGE_SIZE = 16;

const SECTION_MB = 'mb-6';
const GAP_EL = 'gap-2';
/** Matches All Restaurants grid + skeleton grid (no layout shift). */
const ALL_RESTAURANTS_GRID = `grid grid-cols-1 items-stretch sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4 ${GAP_EL}`;

type HomeSortMode = 'default' | 'popular' | 'top_rated' | 'trending' | 'distance';

function SeeAllRestaurantsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm font-semibold transition-opacity hover:opacity-80 hover:underline"
      style={{ color: 'var(--accent-primary)' }}
    >
      See all
    </button>
  );
}

function scrollToAllRestaurants() {
  document.getElementById('all-restaurants')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** After URL/state updates so the #all-restaurants target is stable in layout. */
function scheduleScrollToAllRestaurants() {
  window.setTimeout(() => scrollToAllRestaurants(), 120);
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
  // Avoid stale CDN/browser responses for location-sensitive lists.
  url.searchParams.set('_ts', String(Date.now()));
  return url.toString();
}

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasMounted = useHasMounted();
  /** After mount: matches URL (navbar). Before mount: empty so SSR matches first client paint. */
  const urlQuery = hasMounted ? (searchParams?.get('q') ?? '') : '';
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

  const [gridRestaurants, setGridRestaurants] = useState<Restaurant[]>([]);
  const [gridTotal, setGridTotal] = useState(0);
  const [nextGridPage, setNextGridPage] = useState(2);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [feedLoading, setFeedLoading] = useState(true);
  /** Explicit feed retry (URL unchanged). */
  const [feedRetryNonce, setFeedRetryNonce] = useState(0);

  const [districts, setDistricts] = useState<District[]>([]);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  /** When off, district list is cleared; when on, the dropdown is shown. */
  const [districtFilterEnabled, setDistrictFilterEnabled] = useState(false);
  /** Single geolocation read on load — same coords for bias (default sorts) and strict Nearby. */
  const [userLocation, setUserLocation] = useState<UserLocationState>({ status: 'unknown' });
  const [locationError, setLocationError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [favouriteIds, setFavouriteIds] = useState<Set<number>>(new Set());
  const [favouriteLoadingId, setFavouriteLoadingId] = useState<number | null>(null);
  const [hasToken, setHasToken] = useState(false);

  const [selectedSort, setSelectedSort] = useState<HomeSortMode>('default');
  const [filterHighRating, setFilterHighRating] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [categoryPopupOpen, setCategoryPopupOpen] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<() => void>(() => {});

  useEffect(() => {
    setHasToken(!!getAdminToken());
  }, []);

  useEffect(() => {
    runInitialGeolocation(setUserLocation);
  }, []);

  const locationReady = isLocationResolved(userLocation);

  /** User chose Nearby sort — strict geo (lat+lng+radius) when coordinates are usable. */
  const nearbySortActive = selectedSort === 'distance';
  const strictNearbyReady = nearbySortActive && userLocation.status === 'granted';

  /** Single geo slice for every homepage API (grid, rails, dishes). */
  const geoForApi = useMemo(
    () => buildHomeGeoQuery(userLocation, nearbySortActive, DEFAULT_RADIUS_KM),
    [userLocation, nearbySortActive],
  );

  /** District + geo — identical for restaurant rails and dish rails. */
  const homeSharedQuery = useMemo(
    () => mergeDistrictAndGeo(selectedDistricts, geoForApi),
    [selectedDistricts, geoForApi],
  );

  /**
   * Category dish rail: strict 5 km when coords are trusted; otherwise district / island-wide + cuisine only.
   */
  const categoryNearbyDishesQuery = useMemo((): Record<string, string | number> => {
    const geoSlice: Record<string, string | number> =
      userLocation.status === 'granted'
        ? {
            lat: userLocation.lat,
            lng: userLocation.lng,
            radius_km: CATEGORY_NEARBY_DISH_RADIUS_KM,
          }
        : {};
    return {
      ...mergeDistrictAndGeo(selectedDistricts, geoSlice),
      cuisine: selectedCategories.join(','),
    };
  }, [userLocation, selectedDistricts, selectedCategories]);

  /** All Restaurants grid (adds search, categories, sort). */
  const buildFeedParams = useCallback(() => {
    const params: Record<string, string | number> = { ...homeSharedQuery };
    const q = urlQuery.trim();
    if (q) params.q = q;
    if (selectedCategories.length > 0) params.cuisine = selectedCategories.join(',');

    if (selectedSort === 'distance') {
      if (userLocation.status === 'granted') params.sort = 'distance';
    } else if (selectedSort === 'popular') {
      params.sort = 'popular';
    } else if (selectedSort === 'top_rated') {
      params.sort = 'top_rated';
    } else if (selectedSort === 'trending') {
      params.sort = 'trending';
    }

    return params;
  }, [homeSharedQuery, urlQuery, selectedCategories, selectedSort, userLocation.status]);

  /** Restaurant discovery rails: same shared query + pagination (sort per request). */
  const buildRailParams = useCallback((): Record<string, string | number> => {
    return { page: 1, limit: RAIL_PAGE_SIZE, ...homeSharedQuery };
  }, [homeSharedQuery]);

  const loadRails = useCallback(async () => {
    setRailsLoading(true);
    const base = buildRailParams();
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console -- temporary rail request trace
      console.log('[restaurant rails fetch]', {
        popular: buildApiUrl('/restaurants', { ...base, sort: 'popular' }),
        topRated: buildApiUrl('/restaurants', { ...base, sort: 'top_rated' }),
        trending: buildApiUrl('/restaurants', { ...base, sort: 'trending' }),
      });
    }
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

  const loadFeed = useCallback(async () => {
    setFetchError(null);
    setLoadingMore(false);

    if (!locationReady) {
      setFeedLoading(true);
      return;
    }

    if (selectedSort === 'distance' && userLocation.status !== 'granted') {
      setFeedLoading(false);
      setGridRestaurants([]);
      setGridTotal(0);
      setHasMore(false);
      return;
    }

    setFeedLoading(true);
    const params = buildFeedParams();
    const listUrl = buildApiUrl('/restaurants', { ...params, page: 1, limit: GRID_PAGE_SIZE });
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console -- temporary grid request trace
      console.log('[all restaurants fetch]', listUrl);
    }
    try {
      const gRes = await fetch(listUrl, { cache: 'no-store' }).then(
        (r) => r.json() as Promise<RestaurantsListResponse>,
      );
      const rows = gRes.data ?? [];
      const total = gRes.total ?? 0;
      const meta = gRes.meta;
      setGridRestaurants(rows);
      setGridTotal(total);
      setNextGridPage(2);
      const tp = meta?.totalPages ?? (total > 0 ? Math.ceil(total / GRID_PAGE_SIZE) : 0);
      setHasMore(tp > 1);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error(err);
      setFetchError('Failed to load restaurants. Please try again.');
      setGridRestaurants([]);
      setGridTotal(0);
      setHasMore(false);
    } finally {
      setFeedLoading(false);
    }
  }, [
    buildFeedParams,
    feedRetryNonce,
    selectedSort,
    userLocation.status,
    locationReady,
  ]);

  /** Dev-only: one log line per request surface (verify list === rails base === dishes geo). */
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    if (typeof window === 'undefined') return;
    const base = buildRailParams();
    const feed = buildFeedParams();
    const listUrl = buildApiUrl('/restaurants', { ...feed, page: 1, limit: GRID_PAGE_SIZE });
    const railPopular = buildApiUrl('/restaurants', { ...base, sort: 'popular' });
    const railTop = buildApiUrl('/restaurants', { ...base, sort: 'top_rated' });
    const railTrend = buildApiUrl('/restaurants', { ...base, sort: 'trending' });
    const dishFeatured = buildApiUrl('/dishes/featured', homeSharedQuery);
    const dishTrending = buildApiUrl('/dishes/trending', homeSharedQuery);
    // eslint-disable-next-line no-console -- temporary homepage geo diagnostics
    console.log('[home location requests]', {
      userLocation,
      nearbySortActive,
      strictNearbyReady,
      geoForApi,
      homeSharedQuery,
      allRestaurantsUrl: listUrl,
      restaurantRailPopularUrl: railPopular,
      restaurantRailTopRatedUrl: railTop,
      restaurantRailTrendingUrl: railTrend,
      dishFeaturedUrl: dishFeatured,
      dishTrendingUrl: dishTrending,
    });
  }, [
    userLocation,
    nearbySortActive,
    strictNearbyReady,
    geoForApi,
    homeSharedQuery,
    buildRailParams,
    buildFeedParams,
  ]);

  useEffect(() => {
    if (!locationReady) return;
    void loadRails();
  }, [locationReady, loadRails, homeSharedQuery, selectedSort]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || feedLoading || fetchError) return;
    if (selectedSort === 'distance' && userLocation.status !== 'granted') return;
    setLoadingMore(true);
    const params = buildFeedParams();
    const moreUrl = buildApiUrl('/restaurants', { ...params, page: nextGridPage, limit: GRID_PAGE_SIZE });
    try {
      const res = await fetch(moreUrl, { cache: 'no-store' }).then(
        (r) => r.json() as Promise<RestaurantsListResponse>,
      );
      const rows = res.data ?? [];
      const meta = res.meta;
      setGridRestaurants((prev) => [...prev, ...rows]);
      setNextGridPage((p) => p + 1);
      if (meta) {
        setHasMore(meta.page < meta.totalPages);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error(err);
      setFetchError('Could not load more restaurants.');
    } finally {
      setLoadingMore(false);
    }
  }, [
    hasMore,
    loadingMore,
    feedLoading,
    fetchError,
    nextGridPage,
    buildFeedParams,
    selectedSort,
    userLocation.status,
  ]);

  loadMoreRef.current = loadMore;

  const onIntersect = useCallback(() => {
    if (loadingMore) return;
    void loadMoreRef.current();
  }, [loadingMore]);

  const scrollEnabled = hasMore && !feedLoading && !fetchError;
  useIntersectionLoadMore(sentinelRef, onIntersect, scrollEnabled);

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

  const setDistrictFilterOn = useCallback((on: boolean) => {
    setDistrictFilterEnabled(on);
    if (!on) setSelectedDistricts([]);
  }, []);

  const onDistrictSelectChange = useCallback((value: string) => {
    setSelectedDistricts(value ? [value] : []);
  }, []);

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

  const removeCategory = useCallback(
    (category: string) => {
      const current = parseCategoriesQueryParam(searchParams?.get('categories'));
      setCategoriesInUrl(current.filter((c) => c !== category));
    },
    [searchParams, setCategoriesInUrl],
  );

  const toggleCategory = (category: string) => {
    const next = selectedCategories.includes(category)
      ? selectedCategories.filter((c) => c !== category)
      : [...selectedCategories, category];
    setCategoriesInUrl(next);
    setCategoryPopupOpen(next.length > 0);
    scheduleScrollToAllRestaurants();
  };

  const onSortPopular = () => {
    setLocationError(null);
    setSelectedSort((s) => {
      if (s === 'popular') return 'default';
      scheduleScrollToAllRestaurants();
      return 'popular';
    });
  };

  const onSortTopRated = () => {
    setLocationError(null);
    setSelectedSort((s) => {
      if (s === 'top_rated') return 'default';
      scheduleScrollToAllRestaurants();
      return 'top_rated';
    });
  };

  const onSortTrending = () => {
    setLocationError(null);
    setSelectedSort((s) => {
      if (s === 'trending') return 'default';
      scheduleScrollToAllRestaurants();
      return 'trending';
    });
  };

  /**
   * Nearby = strict mode (same lat/lng as homepage userLocation + radius + sort=distance).
   * Reuses the single initial geolocation read — no second getCurrentPosition.
   */
  const onSortNearby = () => {
    if (selectedSort === 'distance') {
      setLocationError(null);
      clearStoredNearbyGeoMeta();
      setSelectedSort('default');
      return;
    }

    setLocationError(null);
    clearStoredNearbyGeoMeta();

    if (userLocation.status === 'unsupported') {
      setLocationError(NEARBY_UNSUPPORTED_MESSAGE);
      return;
    }
    if (userLocation.status === 'denied' || userLocation.status === 'unknown') {
      setLocationError(
        'Nearby needs your location. Allow access in the browser, refresh the page, then try again — or use District to browse.',
      );
      return;
    }
    if (userLocation.status === 'low_accuracy') {
      setLocationError(
        'Location is not accurate enough to show nearby results. Try a device with GPS, or browse by district.',
      );
      return;
    }

    if (!navigator.geolocation) {
      setLocationError(NEARBY_UNSUPPORTED_MESSAGE);
      return;
    }

    const lat = userLocation.lat;
    const lng = userLocation.lng;
    persistNearbyGeoMetaAfterSuccess({
      lat,
      lng,
      radius_km: DEFAULT_RADIUS_KM,
      positionTimestamp: Date.now(),
    });
    setLocationError(null);
    setSelectedSort('distance');
    scheduleScrollToAllRestaurants();
  };

  const clearSearchQuery = useCallback(() => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.delete('q');
    const query = params.toString();
    router.replace(query ? `/?${query}` : '/', { scroll: false });
  }, [router, searchParams]);

  const removeDistrict = useCallback((name: string) => {
    setSelectedDistricts((prev) => {
      const next = prev.filter((d) => d !== name);
      if (next.length === 0) {
        queueMicrotask(() => setDistrictFilterEnabled(false));
      }
      return next;
    });
  }, []);

  const sortSummaryLabel =
    selectedSort === 'popular'
      ? 'Popular'
      : selectedSort === 'top_rated'
        ? 'Top rated'
        : selectedSort === 'trending'
          ? 'Trending'
          : selectedSort === 'distance'
            ? 'Nearby'
            : null;

  const activeFilterCount =
    (selectedSort !== 'default' ? 1 : 0) +
    selectedCategories.length +
    selectedDistricts.length +
    (filterHighRating ? 1 : 0);

  const hasActiveFilterSummary =
    selectedCategories.length > 0 ||
    selectedSort !== 'default' ||
    urlQuery.trim().length > 0 ||
    selectedDistricts.length > 0 ||
    filterHighRating;

  const softenDiscoveryRails =
    selectedCategories.length > 0 ||
    selectedSort !== 'default' ||
    urlQuery.trim().length > 0 ||
    selectedDistricts.length > 0 ||
    filterHighRating;

  const ratingFilteredGrid = useMemo(() => {
    if (!filterHighRating) return gridRestaurants;
    return gridRestaurants.filter((r) => (r.rating ?? -Infinity) >= RATING_THRESHOLD);
  }, [gridRestaurants, filterHighRating]);

  const displayRestaurants = ratingFilteredGrid;
  const popupRestaurants = useMemo(() => displayRestaurants.slice(0, 6), [displayRestaurants]);

  const railLocationLabel = useMemo(() => {
    if (strictNearbyReady) {
      return `📍 Nearby · ${DEFAULT_RADIUS_KM} km (strict)`;
    }
    if (userLocation.status === 'granted') {
      if (selectedDistricts.length > 0) {
        return `📍 Using your location · ${selectedDistricts[0]}${
          selectedDistricts.length > 1 ? ` +${selectedDistricts.length - 1}` : ''
        }`;
      }
      return '📍 Using your location';
    }
    return getLocationLabel(null, selectedDistricts);
  }, [strictNearbyReady, userLocation, selectedDistricts]);

  const emptyDescription =
    filterHighRating
      ? 'No restaurants match your ⭐ 4.5+ filter. Try clearing filters or adjusting search/sort.'
      : 'Try a different search, filters, or sort.';

  const refetchFeed = () => {
    setFeedRetryNonce((n) => n + 1);
  };

  const clearAllFeedFilters = () => {
    setSelectedSort('default');
    setSelectedDistricts([]);
    setDistrictFilterEnabled(false);
    setFilterHighRating(false);
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.delete('categories');
    params.delete('q');
    const query = params.toString();
    router.replace(query ? `/?${query}` : '/', { scroll: false });
  };

  useEffect(() => {
    if (!categoryPopupOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [categoryPopupOpen]);

  return (
    <main className="mx-auto max-w-screen-xl px-4 py-4 sm:px-6 sm:py-6">
      <section className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
          style={{
            borderColor: filtersOpen || activeFilterCount > 0 ? 'var(--accent-primary)' : 'var(--border)',
            backgroundColor:
              filtersOpen || activeFilterCount > 0
                ? 'color-mix(in srgb, var(--accent-primary) 10%, var(--surface))'
                : 'var(--surface)',
            color: 'var(--text-primary)',
          }}
          aria-expanded={filtersOpen}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="8" y1="12" x2="16" y2="12" />
            <line x1="11" y1="18" x2="13" y2="18" />
          </svg>
          Filters
          {activeFilterCount > 0 && (
            <span
              className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs font-semibold"
              style={{ backgroundColor: 'var(--accent-primary)', color: '#fff' }}
            >
              {activeFilterCount}
            </span>
          )}
        </button>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={clearAllFeedFilters}
            className="text-xs font-medium transition-opacity hover:opacity-70"
            style={{ color: 'var(--accent-primary)' }}
          >
            Clear all
          </button>
        )}
      </section>

      {filtersOpen && (
        <div
          className={`rounded-xl border px-3 py-3 ${SECTION_MB}`}
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
        >
          <div>
            <div className="pb-3">
              <p className="mb-1.5 text-[11px] font-medium leading-tight" style={{ color: 'var(--text-secondary)' }}>
                Sort by
              </p>
              <div className="flex flex-wrap gap-2">
                <UberEatsPill label="Popular" selected={selectedSort === 'popular'} onClick={onSortPopular} />
                <UberEatsPill label="Top Rated" selected={selectedSort === 'top_rated'} onClick={onSortTopRated} />
                <UberEatsPill label="Trending" selected={selectedSort === 'trending'} onClick={onSortTrending} />
                <UberEatsPill
                  label="Nearby (strict)"
                  selected={selectedSort === 'distance'}
                  onClick={onSortNearby}
                  disabled={userLocation.status === 'unknown'}
                />
              </div>
              {locationError && (
                <p
                  className="mt-2 rounded-md border px-3 py-2 text-sm"
                  role="alert"
                  style={{
                    borderColor: 'color-mix(in srgb, var(--border) 80%, transparent)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {locationError}
                </p>
              )}
              {strictNearbyReady && (
                <p className="mt-1.5 text-[11px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
                  Strict mode: within {DEFAULT_RADIUS_KM} km of your position.
                </p>
              )}
            </div>

            <div
              className="border-t pt-3"
              style={{ borderColor: 'color-mix(in srgb, var(--border) 55%, transparent)' }}
            >
              <p className="mb-0.5 text-[11px] font-medium leading-tight" style={{ color: 'var(--text-secondary)' }}>
                Restaurant cuisine
              </p>
              <p className="mb-1.5 text-[11px] leading-snug opacity-90" style={{ color: 'var(--text-secondary)' }}>
                Tags describe venues (not a full dish taxonomy).
              </p>
              <HomeCategoryStrip selected={selectedCategories} onToggle={toggleCategory} />
            </div>

            <div
              className="border-t pt-3"
              style={{ borderColor: 'color-mix(in srgb, var(--border) 55%, transparent)' }}
            >
              <p className="mb-1.5 text-[11px] font-medium leading-tight" style={{ color: 'var(--text-secondary)' }}>
                District
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={districtFilterEnabled}
                  onClick={() => setDistrictFilterOn(!districtFilterEnabled)}
                  className="flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                  style={{
                    borderColor: districtFilterEnabled ? 'var(--accent-primary)' : 'var(--border)',
                    backgroundColor: districtFilterEnabled
                      ? 'color-mix(in srgb, var(--accent-primary) 12%, transparent)'
                      : 'var(--background)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <span
                    className="relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors"
                    style={{ backgroundColor: districtFilterEnabled ? 'var(--accent-primary)' : 'var(--border)' }}
                    aria-hidden
                  >
                    <span
                      className="absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform duration-200"
                      style={{ left: districtFilterEnabled ? 'calc(100% - 0.875rem)' : '0.125rem' }}
                    />
                  </span>
                  <span className="whitespace-nowrap">Filter by district</span>
                </button>
                {districtFilterEnabled && (
                  <select
                    id="home-district-select"
                    className="min-h-[36px] min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] sm:max-w-xs"
                    style={{
                      borderColor: 'var(--border)',
                      backgroundColor: 'var(--background)',
                      color: 'var(--text-primary)',
                    }}
                    value={selectedDistricts[0] ?? ''}
                    onChange={(e) => onDistrictSelectChange(e.target.value)}
                    aria-label="District"
                  >
                    <option value="">All districts</option>
                    {districts.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {fetchError && (
        <div className={SECTION_MB}>
          <ErrorState message={fetchError} onRetry={refetchFeed} />
        </div>
      )}

      {categoryPopupOpen && selectedCategories.length > 0 && (
        <div className="fixed inset-0 z-[70]">
          <button
            type="button"
            aria-label="Close cuisine results"
            onClick={() => setCategoryPopupOpen(false)}
            className="absolute inset-0 bg-black/45"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Restaurant cuisine results"
            className="absolute inset-x-0 bottom-0 top-8 overflow-y-auto rounded-t-3xl border p-4 sm:inset-8 sm:rounded-2xl sm:p-6"
            style={{
              borderColor: 'var(--border)',
              backgroundColor: 'var(--background)',
            }}
          >
            <div className="mx-auto max-w-screen-xl">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                    Cuisine filters
                  </p>
                  <h2 className="text-lg font-semibold sm:text-xl" style={{ color: 'var(--text-primary)' }}>
                    Nearby dishes and matching restaurants
                  </h2>
                  <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {selectedCategories.join(', ')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCategoryPopupOpen(false)}
                  className="inline-flex min-h-[40px] items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-opacity hover:opacity-80"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                >
                  Close
                </button>
              </div>

              <section className="mb-6">
                <NearbyDishesSection
                  locationReady={locationReady}
                  apiQuery={categoryNearbyDishesQuery}
                  locationLabel={railLocationLabel}
                  onSeeAll={scrollToAllRestaurants}
                />
              </section>

              <section>
                <HomeSectionHeader
                  title="Matching restaurants"
                  subtitle="Restaurants tagged with the selected cuisine filters"
                />
                {feedLoading ? (
                  <ul className={ALL_RESTAURANTS_GRID}>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <li key={`popup-restaurant-skeleton-${i}`} className="flex min-h-0">
                        <SkeletonCard variant="grid" className="w-full" />
                      </li>
                    ))}
                  </ul>
                ) : popupRestaurants.length > 0 ? (
                  <>
                    <ul className={`${ALL_RESTAURANTS_GRID} mt-2`}>
                      {popupRestaurants.map((r) => (
                        <li key={`popup-restaurant-${r.id}`} className="flex min-h-0">
                          <RestaurantCard
                            restaurant={r}
                            isFavorite={hasToken && favouriteIds.has(r.id)}
                            favoriteLoading={favouriteLoadingId === r.id}
                            onFavoriteClick={() => handleToggleFavourite(r)}
                            showFavorite={hasToken}
                            className="w-full"
                          />
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3">
                      <Link
                        href="/#all-restaurants"
                        onClick={() => setCategoryPopupOpen(false)}
                        className="text-sm font-semibold transition-opacity hover:opacity-80"
                        style={{ color: 'var(--accent-primary)' }}
                      >
                        See full restaurant results
                      </Link>
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    No matching restaurants loaded yet. Try removing some filters or changing location settings.
                  </p>
                )}
              </section>
            </div>
          </div>
        </div>
      )}

      <section
        className={`${SECTION_MB} space-y-6 transition-opacity duration-300 ease-out ${
          softenDiscoveryRails ? 'opacity-[0.72]' : 'opacity-100'
        }`}
      >
        <PopularDishesSection
          locationReady={locationReady}
          apiQuery={homeSharedQuery}
          locationLabel={railLocationLabel}
          onSeeAll={scrollToAllRestaurants}
        />
        <TrendingDishesSection
          locationReady={locationReady}
          apiQuery={homeSharedQuery}
          locationLabel={railLocationLabel}
          onSeeAll={scrollToAllRestaurants}
        />
        <HorizontalRestaurantSection
          title="🔥 Popular"
          subtitle="Popular picks near you"
          locationLabel={railLocationLabel}
          restaurants={popularRail}
          maxItems={RAIL_PAGE_SIZE}
          isLoading={railsLoading}
          onSeeAll={scrollToAllRestaurants}
          hasToken={hasToken}
          favouriteIds={favouriteIds}
          favouriteLoadingId={favouriteLoadingId}
          onFavoriteClick={handleToggleFavourite}
        />
        <HorizontalRestaurantSection
          title="⭐ Top Rated"
          subtitle="Highly reviewed spots"
          locationLabel={railLocationLabel}
          restaurants={topRatedRail}
          maxItems={RAIL_PAGE_SIZE}
          isLoading={railsLoading}
          onSeeAll={scrollToAllRestaurants}
          hasToken={hasToken}
          favouriteIds={favouriteIds}
          favouriteLoadingId={favouriteLoadingId}
          onFavoriteClick={handleToggleFavourite}
        />
        <HorizontalRestaurantSection
          title="📈 Trending"
          subtitle="Trending near you"
          locationLabel={railLocationLabel}
          restaurants={trendingRail}
          maxItems={RAIL_PAGE_SIZE}
          isLoading={railsLoading}
          onSeeAll={scrollToAllRestaurants}
          hasToken={hasToken}
          favouriteIds={favouriteIds}
          favouriteLoadingId={favouriteLoadingId}
          onFavoriteClick={handleToggleFavourite}
        />
      </section>

      <section
        id="all-restaurants"
        className="scroll-mt-28 border-t pt-6 md:scroll-mt-32 md:pt-6"
        style={{ borderColor: 'var(--border)' }}
      >
        {hasActiveFilterSummary && (
          <div className="mb-3 flex flex-col gap-2 border-b pb-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3" style={{ borderColor: 'color-mix(in srgb, var(--border) 70%, transparent)' }}>
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
              <span className="shrink-0 text-[11px] leading-tight" style={{ color: 'var(--text-secondary)' }}>
                Showing results for
              </span>
              <span className="hidden h-3 w-px shrink-0 bg-[color-mix(in_srgb,var(--border)_80%,transparent)] sm:inline" aria-hidden />
              <div className={`flex min-w-0 flex-wrap items-center ${GAP_EL}`}>
                {selectedCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => removeCategory(cat)}
                    className="inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-85 active:opacity-75"
                    style={{
                      borderColor: 'color-mix(in srgb, var(--border) 85%, transparent)',
                      backgroundColor: 'var(--background)',
                      color: 'var(--text-primary)',
                    }}
                    aria-label={`Remove category ${cat}`}
                  >
                    <span className="truncate">{cat}</span>
                    <span className="shrink-0 opacity-60" style={{ color: 'var(--text-secondary)' }} aria-hidden>
                      ×
                    </span>
                  </button>
                ))}
                {selectedDistricts.map((d) => (
                  <button
                    key={`d-${d}`}
                    type="button"
                    onClick={() => removeDistrict(d)}
                    className="inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-85 active:opacity-75"
                    style={{
                      borderColor: 'color-mix(in srgb, var(--border) 85%, transparent)',
                      backgroundColor: 'var(--background)',
                      color: 'var(--text-primary)',
                    }}
                    aria-label={`Remove district ${d}`}
                  >
                    <span className="truncate">{d}</span>
                    <span className="shrink-0 opacity-60" style={{ color: 'var(--text-secondary)' }} aria-hidden>
                      ×
                    </span>
                  </button>
                ))}
                {urlQuery.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={clearSearchQuery}
                    className="inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-85 active:opacity-75"
                    style={{
                      borderColor: 'color-mix(in srgb, var(--border) 85%, transparent)',
                      backgroundColor: 'var(--background)',
                      color: 'var(--text-primary)',
                    }}
                    aria-label="Clear search"
                  >
                    <span className="truncate">&quot;{urlQuery.trim()}&quot;</span>
                    <span className="shrink-0 opacity-60" style={{ color: 'var(--text-secondary)' }} aria-hidden>
                      ×
                    </span>
                  </button>
                )}
                {sortSummaryLabel && (
                  <button
                    type="button"
                    onClick={() => {
                      setLocationError(null);
                      setSelectedSort('default');
                    }}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-85 active:opacity-75"
                    style={{
                      borderColor: 'color-mix(in srgb, var(--border) 85%, transparent)',
                      backgroundColor: 'var(--background)',
                      color: 'var(--text-primary)',
                    }}
                    aria-label="Clear sort"
                  >
                    <span className="whitespace-nowrap">Sort: {sortSummaryLabel}</span>
                    <span className="shrink-0 opacity-60" style={{ color: 'var(--text-secondary)' }} aria-hidden>
                      ×
                    </span>
                  </button>
                )}
                {filterHighRating && (
                  <button
                    type="button"
                    onClick={() => setFilterHighRating(false)}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-85 active:opacity-75"
                    style={{
                      borderColor: 'color-mix(in srgb, var(--border) 85%, transparent)',
                      backgroundColor: 'var(--background)',
                      color: 'var(--text-primary)',
                    }}
                    aria-label="Remove 4.5+ rating filter"
                  >
                    <span>⭐ 4.5+</span>
                    <span className="shrink-0 opacity-60" style={{ color: 'var(--text-secondary)' }} aria-hidden>
                      ×
                    </span>
                  </button>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={clearAllFeedFilters}
              className="shrink-0 self-start text-[11px] font-medium underline-offset-2 transition-opacity hover:opacity-75 sm:self-center"
              style={{ color: 'var(--accent-primary)' }}
            >
              Clear all
            </button>
          </div>
        )}

        <HomeSectionHeader
          title="All Restaurants"
          subtitle="Full directory"
          onSeeAll={scrollToAllRestaurants}
          rightSlot={
            !feedLoading && gridTotal > 0 ? (
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                {gridTotal} {gridTotal === 1 ? 'place' : 'places'}
                {hasMore ? ' · Scroll for more' : ''}
              </p>
            ) : null
          }
        />

        <div className={`mb-4 flex flex-wrap items-center ${GAP_EL}`}>
          <UberEatsPill
            label="⭐ 4.5+"
            selected={filterHighRating}
            onClick={() => setFilterHighRating((v) => !v)}
          />
        </div>

        <div className="relative">
          {/* Initial feed load — crossfade out when data arrives */}
          <div
            className={`transition-opacity duration-200 ease-out ${
              feedLoading
                ? 'relative z-[2] opacity-100'
                : 'pointer-events-none absolute inset-0 z-0 opacity-0'
            }`}
            aria-hidden={!feedLoading}
          >
            <ul className={ALL_RESTAURANTS_GRID}>
              {Array.from({ length: GRID_PAGE_SIZE }).map((_, i) => (
                <li key={i} className="flex min-h-0">
                  <SkeletonCard variant="grid" className="w-full" />
                </li>
              ))}
            </ul>
          </div>

          <div
            className={`transition-opacity duration-200 ease-out ${
              feedLoading
                ? 'pointer-events-none absolute inset-0 z-0 opacity-0'
                : 'relative z-[2] opacity-100'
            }`}
            aria-hidden={feedLoading}
          >
            {!feedLoading && !fetchError && gridTotal === 0 ? (
              <div className="lm-fade-in">
                <EmptyState
                  title="No restaurants found"
                  description={emptyDescription}
                  action={
                    <button
                      type="button"
                      onClick={refetchFeed}
                      className="min-h-[44px] rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-opacity duration-200 active:opacity-90"
                      style={{ backgroundColor: 'var(--accent-primary)' }}
                    >
                      Retry
                    </button>
                  }
                />
              </div>
            ) : !feedLoading && !fetchError && displayRestaurants.length === 0 ? (
              <div className="lm-fade-in">
                <EmptyState
                  title="No restaurants match filters"
                  description="Nothing on this page matches ⭐ 4.5+. Clear filters or adjust your search."
                  action={
                    <button
                      type="button"
                      onClick={clearAllFeedFilters}
                      className="min-h-[44px] rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-opacity duration-200 active:opacity-90"
                      style={{ backgroundColor: 'var(--accent-primary)' }}
                    >
                      Clear filters
                    </button>
                  }
                />
              </div>
            ) : !feedLoading && !fetchError ? (
              <>
                <ul className={`${ALL_RESTAURANTS_GRID} lm-fade-in`}>
                  {displayRestaurants.map((r) => (
                    <li key={r.id} className="flex min-h-0">
                      <RestaurantCard
                        restaurant={r}
                        isFavorite={hasToken && favouriteIds.has(r.id)}
                        favoriteLoading={favouriteLoadingId === r.id}
                        onFavoriteClick={() => handleToggleFavourite(r)}
                        showFavorite={hasToken}
                        className="w-full"
                      />
                    </li>
                  ))}
                </ul>

                {loadingMore && (
                  <div
                    className={`mt-6 ${ALL_RESTAURANTS_GRID}`}
                    aria-busy="true"
                    aria-label="Loading more restaurants"
                  >
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={`more-${i}`} className="flex min-h-0">
                        <SkeletonCard variant="grid" className="w-full lm-fade-in" />
                      </div>
                    ))}
                  </div>
                )}

                <div className={`flex flex-col items-center py-6 ${GAP_EL}`}>
                  {!hasMore && gridTotal > 0 && (
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      You&apos;re all caught up.
                    </p>
                  )}
                  <div ref={sentinelRef} className="h-1 w-full shrink-0" aria-hidden />
                </div>
              </>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
