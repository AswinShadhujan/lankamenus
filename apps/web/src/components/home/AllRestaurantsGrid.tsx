'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Restaurant, RestaurantsListResponse } from '@/types/restaurant';
import { RestaurantCard } from '@/components/ui/RestaurantCard';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { useIntersectionLoadMore } from '@/hooks/useIntersectionLoadMore';
import { buildApiUrl } from '@/lib/buildApiUrl';

const GRID_PAGE_SIZE = 12;
const RATING_THRESHOLD = 4.5;

const ALL_RESTAURANTS_GRID =
  'grid grid-cols-2 gap-3 items-stretch md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6';

export type AllRestaurantsGridProps = {
  buildListParams: () => Record<string, string | number>;
  locationReady: boolean;
  filterHighRating: boolean;
  hasToken: boolean;
  favouriteIds: Set<number>;
  favouriteLoadingId: number | null;
  onFavoriteClick: (restaurant: Restaurant) => void;
  emptyDescription?: string;
  onClearFilters?: () => void;
};

export function AllRestaurantsGrid({
  buildListParams,
  locationReady,
  filterHighRating,
  hasToken,
  favouriteIds,
  favouriteLoadingId,
  onFavoriteClick,
  emptyDescription = 'Try a different search, filters, or sort.',
  onClearFilters,
}: AllRestaurantsGridProps) {
  const [gridRestaurants, setGridRestaurants] = useState<Restaurant[]>([]);
  const [gridTotal, setGridTotal] = useState(0);
  const [nextGridPage, setNextGridPage] = useState(2);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [feedLoading, setFeedLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [feedRetryNonce, setFeedRetryNonce] = useState(0);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<() => void>(() => {});

  const listParamsKey = useMemo(() => JSON.stringify(buildListParams()), [buildListParams]);

  const loadFeed = useCallback(async () => {
    setFetchError(null);
    setLoadingMore(false);

    if (!locationReady) {
      setFeedLoading(true);
      return;
    }

    setFeedLoading(true);
    const params = buildListParams();
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
  }, [buildListParams, locationReady, feedRetryNonce]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed, listParamsKey]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || feedLoading || fetchError) return;
    setLoadingMore(true);
    const params = buildListParams();
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
  }, [hasMore, loadingMore, feedLoading, fetchError, nextGridPage, buildListParams]);

  loadMoreRef.current = loadMore;

  const onIntersect = useCallback(() => {
    if (loadingMore) return;
    void loadMoreRef.current();
  }, [loadingMore]);

  const scrollEnabled = hasMore && !feedLoading && !fetchError;
  useIntersectionLoadMore(sentinelRef, onIntersect, scrollEnabled);

  const displayRestaurants = useMemo(() => {
    if (!filterHighRating) return gridRestaurants;
    return gridRestaurants.filter((r) => (r.rating ?? -Infinity) >= RATING_THRESHOLD);
  }, [gridRestaurants, filterHighRating]);

  const refetchFeed = () => setFeedRetryNonce((n) => n + 1);

  if (fetchError && !feedLoading && gridRestaurants.length === 0) {
    return <ErrorState message={fetchError} onRetry={refetchFeed} />;
  }

  return (
    <div className="relative">
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
              <SkeletonCard variant="compact" className="w-full" />
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
                onClearFilters ? (
                  <button
                    type="button"
                    onClick={onClearFilters}
                    className="min-h-[44px] rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-opacity duration-200 active:opacity-90"
                    style={{ backgroundColor: 'var(--accent-primary)' }}
                  >
                    Clear filters
                  </button>
                ) : undefined
              }
            />
          </div>
        ) : !feedLoading && !fetchError ? (
          <>
            <ul className={`${ALL_RESTAURANTS_GRID} lm-fade-in`}>
              {displayRestaurants.map((r) => (
                <li key={r.id} className="flex min-h-0">
                  <RestaurantCard
                    variant="compact"
                    restaurant={r}
                    isFavorite={hasToken && favouriteIds.has(r.id)}
                    favoriteLoading={favouriteLoadingId === r.id}
                    onFavoriteClick={() => onFavoriteClick(r)}
                    showFavorite={hasToken}
                    className="w-full"
                  />
                </li>
              ))}
            </ul>

            {loadingMore && (
              <div className={`mt-6 ${ALL_RESTAURANTS_GRID}`} aria-busy="true" aria-label="Loading more restaurants">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={`more-${i}`} className="flex min-h-0">
                    <SkeletonCard variant="compact" className="w-full lm-fade-in" />
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col items-center gap-2 py-6">
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
  );
}
