'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api, { getAdminToken, getApiBaseUrl } from '@/lib/api';
import { Restaurant, District, type RestaurantsListResponse } from '@/types/restaurant';
import { RestaurantCard } from '@/components/ui/RestaurantCard';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { HomeSectionHeader } from '@/components/home/HomeSectionHeader';
import { HomeCategoryStrip } from '@/components/home/HomeCategoryStrip';
import { UberEatsPill, UberEatsPillRow, UBER_EATS_ACCENT } from '@/components/ui/UberEatsPill';
import { HorizontalRestaurantSection } from '@/components/shared/HorizontalRestaurantSection';
import {
  PopularDishesSection,
  TrendingDishesSection,
} from '@/components/DishDiscoveryRailSection';
import { useIntersectionLoadMore } from '@/hooks/useIntersectionLoadMore';
import { getLocationLabel } from '@/lib/getLocationLabel';
import {
  parseCategoriesQueryParam,
  serializeCategoriesQuery,
} from '@/lib/foodCategories';
import { useHasMounted } from '@/hooks/useHasMounted';
import {
  FRESH_GEO_OPTIONS,
  clearStoredNearbyGeoMeta,
  geolocationFailureMessage,
  persistNearbyGeoMetaAfterSuccess,
} from '@/lib/geolocationFresh';
import {
  MAX_BROWSER_ACCURACY_METERS,
  browserPositionToNearbyState,
  isBrowserGeolocationAccurateEnough,
} from '@/lib/nearbyBrowserGeo';
import {
  isLocationResolved,
  runInitialGeolocation,
  type UserLocationState,
} from '@/lib/homeUserLocation';

const DEFAULT_RADIUS_KM = 10;

const NEARBY_UNSUPPORTED_MESSAGE =
  'This browser does not support location. Use District to narrow results.';
const RATING_THRESHOLD = 4.5;
const GRID_PAGE_SIZE = 12;
const RAIL_PAGE_SIZE = 16;

const SECTION_MB = 'mb-8';
const GAP_EL = 'gap-3';
/** Matches All Restaurants grid + skeleton grid (no layout shift). */
const ALL_RESTAURANTS_GRID = `grid grid-cols-1 items-stretch sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 ${GAP_EL}`;

type HomeSortMode = 'default' | 'popular' | 'top_rated' | 'trending' | 'distance';

function SeeAllRestaurantsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm font-semibold transition-opacity hover:opacity-80 hover:underline"
      style={{ color: UBER_EATS_ACCENT }}
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
  /** Single read on load — bias (lat/lng only) for default mode. */
  const [userLocation, setUserLocation] = useState<UserLocationState>({ status: 'unknown' });
  /** Strict Nearby: lat/lng + radius; only set while sort is Nearby and fix succeeded. */
  const [nearbySession, setNearbySession] = useState<{
    lat: number;
    lng: number;
    radiusKm: number;
  } | null>(null);
  const [nearbyRequestLoading, setNearbyRequestLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [favouriteIds, setFavouriteIds] = useState<Set<number>>(new Set());
  const [favouriteLoadingId, setFavouriteLoadingId] = useState<number | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [backendHealthStatus, setBackendHealthStatus] = useState<string | null>(null);

  const [selectedSort, setSelectedSort] = useState<HomeSortMode>('default');
  const [filterHighRating, setFilterHighRating] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<() => void>(() => {});

  useEffect(() => {
    setHasToken(!!getAdminToken());
  }, []);

  useEffect(() => {
    runInitialGeolocation(setUserLocation);
  }, []);

  // Test backend reachability: same base as fetch() (env or localhost :3001 fallback).
  // Uses `cache: "no-store"` to avoid cached results across deployments.
  useEffect(() => {
    const apiBase = getApiBaseUrl().replace(/\/$/, '');
    const healthUrl = `${apiBase}/health`;

    if (!apiBase) {
      setBackendHealthStatus('missing_api_url');
      return;
    }

    let cancelled = false;
    async function run() {
      try {
        const res = await fetch(healthUrl, { cache: 'no-store' });
        const data = (await res.json()) as { status?: string };
        if (cancelled) return;
        setBackendHealthStatus(data?.status ?? `http_${res.status}`);
      } catch {
        if (cancelled) return;
        setBackendHealthStatus('unreachable');
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  /** Leaving Nearby sort clears strict session (bias coords from initial read remain). */
  useEffect(() => {
    if (selectedSort !== 'distance') {
      setNearbySession(null);
      setNearbyRequestLoading(false);
    }
  }, [selectedSort]);

  const locationReady = isLocationResolved(userLocation);

  /**
   * Default mode: lat/lng only (ranking bias). Nearby mode: lat/lng/radius_km (strict).
   * Never sends radius without Nearby.
   */
  const homeGeoParams = useCallback((): Record<string, string | number> => {
    const g: Record<string, string | number> = {};
    if (selectedSort === 'distance') {
      if (nearbySession) {
        g.lat = nearbySession.lat;
        g.lng = nearbySession.lng;
        g.radius_km = nearbySession.radiusKm;
      }
      return g;
    }
    if (userLocation.status === 'granted') {
      g.lat = userLocation.lat;
      g.lng = userLocation.lng;
    }
    return g;
  }, [selectedSort, nearbySession, userLocation]);

  const dishDistrictCsv = useMemo(() => {
    if (selectedDistricts.length === 0) return null;
    return selectedDistricts.join(',');
  }, [selectedDistricts]);

  const dishStrictNearby = useMemo(
    () =>
      selectedSort === 'distance' && nearbySession
        ? {
            lat: nearbySession.lat,
            lng: nearbySession.lng,
            radius_km: nearbySession.radiusKm,
          }
        : null,
    [selectedSort, nearbySession],
  );

  const dishBiasCoords = useMemo(() => {
    if (dishStrictNearby) return null;
    if (userLocation.status !== 'granted') return null;
    return { lat: userLocation.lat, lng: userLocation.lng };
  }, [dishStrictNearby, userLocation]);

  /** All Restaurants grid. */
  const buildFeedParams = useCallback(() => {
    const params: Record<string, string | number> = {};
    const q = urlQuery.trim();
    if (q) params.q = q;
    if (selectedDistricts.length > 0) params.district = selectedDistricts.join(',');
    if (selectedCategories.length > 0) params.cuisine = selectedCategories.join(',');

    Object.assign(params, homeGeoParams());

    if (selectedSort === 'distance') {
      if (nearbySession) params.sort = 'distance';
    } else if (selectedSort === 'popular') {
      params.sort = 'popular';
    } else if (selectedSort === 'top_rated') {
      params.sort = 'top_rated';
    } else if (selectedSort === 'trending') {
      params.sort = 'trending';
    }

    return params;
  }, [
    urlQuery,
    selectedDistricts,
    selectedCategories,
    selectedSort,
    nearbySession,
    homeGeoParams,
  ]);

  const buildRailParams = useCallback((): Record<string, string | number> => {
    const params: Record<string, string | number> = { page: 1, limit: RAIL_PAGE_SIZE };
    if (selectedDistricts.length > 0) params.district = selectedDistricts.join(',');
    Object.assign(params, homeGeoParams());
    return params;
  }, [selectedDistricts, homeGeoParams]);

  /** Do not call APIs until strict Nearby has a full fix. */
  const deferUntilNearbyReady =
    selectedSort === 'distance' && nearbyRequestLoading && !nearbySession;

  const loadRails = useCallback(async () => {
    if (deferUntilNearbyReady) {
      setRailsLoading(true);
      return;
    }
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
  }, [deferUntilNearbyReady, buildRailParams]);

  const loadFeed = useCallback(async () => {
    setFetchError(null);
    setLoadingMore(false);

    if (!locationReady) {
      setFeedLoading(true);
      return;
    }

    if (selectedSort === 'distance') {
      if (nearbyRequestLoading && !nearbySession) {
        setFeedLoading(true);
        return;
      }
      if (!nearbySession) {
        setFeedLoading(false);
        setGridRestaurants([]);
        setGridTotal(0);
        setHasMore(false);
        return;
      }
    }

    setFeedLoading(true);
    const params = buildFeedParams();
    const listUrl = buildApiUrl('/restaurants', { ...params, page: 1, limit: GRID_PAGE_SIZE });
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
    nearbySession,
    nearbyRequestLoading,
    locationReady,
  ]);

  useEffect(() => {
    if (!locationReady) return;
    void loadRails();
  }, [
    locationReady,
    loadRails,
    deferUntilNearbyReady,
    nearbySession,
    userLocation,
    selectedDistricts.join(','),
    selectedSort,
  ]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || feedLoading || fetchError) return;
    if (selectedSort === 'distance' && !nearbySession) return;
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
  }, [hasMore, loadingMore, feedLoading, fetchError, nextGridPage, buildFeedParams, selectedSort, nearbySession]);

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

  const toggleDistrict = (name: string) => {
    setSelectedDistricts((prev) =>
      prev.includes(name) ? prev.filter((d) => d !== name) : [...prev, name],
    );
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
    scheduleScrollToAllRestaurants();
  };

  const onSortPopular = () => {
    setLocationError(null);
    setSelectedSort((s) => (s === 'popular' ? 'default' : 'popular'));
    scheduleScrollToAllRestaurants();
  };

  const onSortTopRated = () => {
    setLocationError(null);
    setSelectedSort((s) => (s === 'top_rated' ? 'default' : 'top_rated'));
    scheduleScrollToAllRestaurants();
  };

  const onSortTrending = () => {
    setLocationError(null);
    setSelectedSort((s) => (s === 'trending' ? 'default' : 'trending'));
    scheduleScrollToAllRestaurants();
  };

  /**
   * Nearby = strict mode (radius + sort=distance). Requires an initial granted location;
   * then requests a fresh high-accuracy fix. Never falls back to island-wide while enabled.
   */
  const onSortNearby = () => {
    if (selectedSort === 'distance') {
      setLocationError(null);
      setNearbyRequestLoading(false);
      clearStoredNearbyGeoMeta();
      setSelectedSort('default');
      scheduleScrollToAllRestaurants();
      return;
    }

    setLocationError(null);
    clearStoredNearbyGeoMeta();
    setNearbySession(null);

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

    setSelectedSort('distance');
    setNearbyRequestLoading(true);

    if (!navigator.geolocation) {
      setLocationError(NEARBY_UNSUPPORTED_MESSAGE);
      setNearbyRequestLoading(false);
      setSelectedSort('default');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const acc = position.coords.accuracy;

        if (isBrowserGeolocationAccurateEnough(acc)) {
          const session = browserPositionToNearbyState(lat, lng, DEFAULT_RADIUS_KM, acc as number);
          setNearbySession({
            lat: session.lat,
            lng: session.lng,
            radiusKm: session.radius_km,
          });
          persistNearbyGeoMetaAfterSuccess({
            lat,
            lng,
            radius_km: DEFAULT_RADIUS_KM,
            positionTimestamp: position.timestamp,
          });
          setLocationError(null);
        } else {
          const accLabel =
            acc != null && Number.isFinite(acc) ? `~${Math.round(acc)} m` : 'unknown';
          setLocationError(
            `Location accuracy is too low for Nearby (${accLabel}; need about ${MAX_BROWSER_ACCURACY_METERS} m or better). Use District to browse, or try again with a clearer GPS signal.`,
          );
          setSelectedSort('default');
          setNearbySession(null);
        }
        setNearbyRequestLoading(false);
        scheduleScrollToAllRestaurants();
      },
      (err) => {
        setLocationError(geolocationFailureMessage(err));
        setNearbyRequestLoading(false);
        setSelectedSort('default');
        setNearbySession(null);
        scheduleScrollToAllRestaurants();
      },
      FRESH_GEO_OPTIONS,
    );
  };

  const clearSearchQuery = useCallback(() => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.delete('q');
    const query = params.toString();
    router.replace(query ? `/?${query}` : '/', { scroll: false });
  }, [router, searchParams]);

  const removeDistrict = useCallback((name: string) => {
    setSelectedDistricts((prev) => prev.filter((d) => d !== name));
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

  const districtScopeLabel = useMemo(() => {
    if (selectedDistricts.length === 0) return 'All Districts';
    if (selectedDistricts.length === 1) return selectedDistricts[0];
    return `${selectedDistricts.length} districts`;
  }, [selectedDistricts]);

  const railLocationLabel = useMemo(() => {
    if (selectedSort === 'distance' && nearbySession) {
      return `📍 Nearby · ${nearbySession.radiusKm} km (strict)`;
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
  }, [selectedSort, nearbySession, userLocation, selectedDistricts]);

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
    setFilterHighRating(false);
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.delete('categories');
    params.delete('q');
    const query = params.toString();
    router.replace(query ? `/?${query}` : '/', { scroll: false });
  };

  const stickyBarBg = 'color-mix(in srgb, var(--background) 94%, transparent)';

  return (
    <main className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
      <section
        className="mb-4 rounded-xl border px-4 py-3"
        style={{ borderColor: 'var(--border)', backgroundColor: 'color-mix(in srgb, var(--surface), transparent 12%)' }}
      >
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
          Backend status
        </p>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-primary)' }}>
          {backendHealthStatus ? `API: ${backendHealthStatus}` : 'Checking API...'}
        </p>
      </section>
      <section className={SECTION_MB}>
        <div
          className="rounded-2xl border p-4 sm:p-5"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
        >
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                District
              </p>
              <p className="mt-1 text-base font-semibold sm:text-lg" style={{ color: 'var(--text-primary)' }}>
                {districtScopeLabel}
              </p>
              <p className="mt-1 max-w-xl text-xs leading-relaxed sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
                Primary location for browsing. Applies to the discovery rails and the All Restaurants list.
              </p>
            </div>
            <div className="shrink-0 sm:pt-0.5">
              <SeeAllRestaurantsButton onClick={scrollToAllRestaurants} />
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto scroll-smooth pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <UberEatsPill
              label="All Districts"
              selected={selectedDistricts.length === 0}
              onClick={() => setSelectedDistricts([])}
            />
            {districts.map((d) => (
              <UberEatsPill
                key={d.id}
                label={d.name}
                selected={selectedDistricts.includes(d.name)}
                onClick={() => toggleDistrict(d.name)}
              />
            ))}
          </div>
        </div>
      </section>

      <div
        className={`sticky top-0 z-30 -mx-4 mb-6 border-b px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 ${SECTION_MB}`}
        style={{
          borderColor: 'var(--border)',
          backgroundColor: stickyBarBg,
        }}
      >
        <UberEatsPillRow
          title="Sort by"
          className="!mb-0"
          trailingAction={<SeeAllRestaurantsButton onClick={scrollToAllRestaurants} />}
        >
          <UberEatsPill
            label="Popular"
            selected={selectedSort === 'popular'}
            onClick={onSortPopular}
          />
          <UberEatsPill
            label="Top Rated"
            selected={selectedSort === 'top_rated'}
            onClick={onSortTopRated}
          />
          <UberEatsPill
            label="Trending"
            selected={selectedSort === 'trending'}
            onClick={onSortTrending}
          />
          <UberEatsPill
            label="Nearby (strict)"
            selected={selectedSort === 'distance'}
            onClick={onSortNearby}
            disabled={nearbyRequestLoading || userLocation.status === 'unknown'}
          />
        </UberEatsPillRow>
        {userLocation.status === 'unknown' && (
          <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }} role="status">
            Checking location permission…
          </p>
        )}
        {userLocation.status === 'granted' && selectedSort !== 'distance' && (
          <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Using your location for rankings across Sri Lanka. Nearby turns on strict distance filtering within a
            set radius.
          </p>
        )}
        {(userLocation.status === 'denied' || userLocation.status === 'unsupported') &&
          selectedSort !== 'distance' && (
            <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Location unavailable — showing island-wide results. Use District filters, or enable location and
              refresh.
            </p>
          )}
        {locationError && (
          <p className="mt-3 rounded-lg border px-3 py-2 text-sm" role="alert" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
            {locationError}
          </p>
        )}
        {selectedSort === 'distance' && nearbyRequestLoading && !nearbySession && (
          <p className="mt-3 text-xs" style={{ color: 'var(--text-secondary)' }} role="status">
            Getting a precise location for Nearby…
          </p>
        )}
        {selectedSort === 'distance' && nearbySession && (
          <div className="mt-3">
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Strict mode: restaurants and dishes within {nearbySession.radiusKm} km of your current position.
            </p>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
              List, dish rails, and restaurant rails use the same coordinates — no silent island-wide fallback.
            </p>
          </div>
        )}
      </div>

      <section className={SECTION_MB}>
        <div
          className="rounded-2xl border p-4"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
              Categories
            </p>
            <SeeAllRestaurantsButton onClick={scrollToAllRestaurants} />
          </div>
          <HomeCategoryStrip selected={selectedCategories} onToggle={toggleCategory} />
        </div>
      </section>

      {fetchError && (
        <div className={SECTION_MB}>
          <ErrorState message={fetchError} onRetry={refetchFeed} />
        </div>
      )}

      <section
        className={`${SECTION_MB} space-y-8 transition-opacity duration-300 ease-out ${
          softenDiscoveryRails ? 'opacity-[0.72]' : 'opacity-100'
        }`}
      >
        <PopularDishesSection
          locationReady={locationReady}
          strictNearbyCoords={dishStrictNearby}
          biasCoords={dishBiasCoords}
          districtCsv={dishDistrictCsv}
          deferUntilNearbyReady={deferUntilNearbyReady}
          locationLabel={railLocationLabel}
          onSeeAll={scrollToAllRestaurants}
        />
        <TrendingDishesSection
          locationReady={locationReady}
          strictNearbyCoords={dishStrictNearby}
          biasCoords={dishBiasCoords}
          districtCsv={dishDistrictCsv}
          deferUntilNearbyReady={deferUntilNearbyReady}
          locationLabel={railLocationLabel}
          onSeeAll={scrollToAllRestaurants}
        />
        <HorizontalRestaurantSection
          title="🔥 Popular"
          subtitle="Most ordered nearby"
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
          subtitle="Hot right now"
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
        className="scroll-mt-28 border-t pt-8 md:scroll-mt-32 md:pt-8"
        style={{ borderColor: 'var(--border)' }}
      >
        {hasActiveFilterSummary && (
          <div
            className="mb-4 rounded-xl border px-3 py-3 sm:px-4"
            style={{
              borderColor: 'var(--border)',
              backgroundColor: 'color-mix(in srgb, var(--accent-primary) 6%, var(--surface))',
            }}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                  Showing results for
                </p>
                <div className={`mt-2 flex flex-wrap items-center ${GAP_EL}`}>
                  {selectedCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => removeCategory(cat)}
                      className="inline-flex min-h-[36px] max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors hover:opacity-90 active:opacity-80"
                      style={{
                        borderColor: 'var(--border)',
                        backgroundColor: 'var(--background)',
                        color: 'var(--text-primary)',
                      }}
                      aria-label={`Remove category ${cat}`}
                    >
                      <span className="truncate">{cat}</span>
                      <span className="shrink-0 text-[var(--text-secondary)]" aria-hidden>
                        ✕
                      </span>
                    </button>
                  ))}
                  {selectedDistricts.map((d) => (
                    <button
                      key={`d-${d}`}
                      type="button"
                      onClick={() => removeDistrict(d)}
                      className="inline-flex min-h-[36px] max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors hover:opacity-90 active:opacity-80"
                      style={{
                        borderColor: 'var(--border)',
                        backgroundColor: 'var(--background)',
                        color: 'var(--text-primary)',
                      }}
                      aria-label={`Remove district ${d}`}
                    >
                      <span className="truncate">{d}</span>
                      <span className="shrink-0 text-[var(--text-secondary)]" aria-hidden>
                        ✕
                      </span>
                    </button>
                  ))}
                  {urlQuery.trim().length > 0 && (
                    <button
                      type="button"
                      onClick={clearSearchQuery}
                      className="inline-flex min-h-[36px] max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors hover:opacity-90 active:opacity-80"
                      style={{
                        borderColor: 'var(--border)',
                        backgroundColor: 'var(--background)',
                        color: 'var(--text-primary)',
                      }}
                      aria-label="Clear search"
                    >
                      <span className="truncate">&quot;{urlQuery.trim()}&quot;</span>
                      <span className="shrink-0 text-[var(--text-secondary)]" aria-hidden>
                        ✕
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
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors hover:opacity-90 active:opacity-80"
                      style={{
                        borderColor: UBER_EATS_ACCENT,
                        backgroundColor: 'color-mix(in srgb, var(--accent-primary) 10%, transparent)',
                        color: 'var(--text-primary)',
                      }}
                      aria-label="Clear sort"
                    >
                      <span className="whitespace-nowrap">Sort: {sortSummaryLabel}</span>
                      <span className="shrink-0 text-[var(--text-secondary)]" aria-hidden>
                        ✕
                      </span>
                    </button>
                  )}
                  {filterHighRating && (
                    <button
                      type="button"
                      onClick={() => setFilterHighRating(false)}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors hover:opacity-90 active:opacity-80"
                      style={{
                        borderColor: 'var(--border)',
                        backgroundColor: 'var(--background)',
                        color: 'var(--text-primary)',
                      }}
                      aria-label="Remove 4.5+ rating filter"
                    >
                      <span>⭐ 4.5+</span>
                      <span className="shrink-0 text-[var(--text-secondary)]" aria-hidden>
                        ✕
                      </span>
                    </button>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={clearAllFeedFilters}
                className="shrink-0 text-sm font-semibold underline-offset-2 transition-opacity hover:opacity-80 sm:pt-5"
                style={{ color: UBER_EATS_ACCENT }}
              >
                Clear all
              </button>
            </div>
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
