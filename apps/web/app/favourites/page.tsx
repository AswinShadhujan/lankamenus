'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api, { getAdminToken } from '@/lib/api';
import { Restaurant } from '@/types/restaurant';
import { RestaurantCard } from '@/components/ui/RestaurantCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { RestaurantCardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';

const PAGE_SIZE = 12;

export default function FavouritesPage() {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  const total = restaurants.length;
  const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const pagedRestaurants = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return restaurants.slice(start, start + PAGE_SIZE);
  }, [restaurants, page]);

  useEffect(() => {
    if (page > maxPage) setPage(maxPage);
  }, [page, maxPage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!getAdminToken()) {
      router.replace('/login');
      return;
    }
    api
      .get<{ data: Restaurant[] }>('/users/me/favourites')
      .then((res) => setRestaurants(res.data.data ?? []))
      .catch((err) => {
        if (err.response?.status === 401) router.replace('/login');
        else setRestaurants([]);
      })
      .finally(() => setLoading(false));
  }, [router]);

  const handleRemove = (restaurantId: number) => {
    setRemovingId(restaurantId);
    api
      .delete(`/users/me/favourites/${restaurantId}`)
      .then(() => setRestaurants((prev) => prev.filter((r) => r.id !== restaurantId)))
      .catch(() => {})
      .finally(() => setRemovingId(null));
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <SectionHeader title="My favourites" className="mb-6" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <RestaurantCardSkeleton key={i} />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
      <nav className="mb-5 flex items-center gap-3 text-small">
        <Link
          href="/"
          className="font-medium transition-opacity hover:opacity-80"
          style={{ color: 'var(--accent-primary)' }}
        >
          ← Back to restaurants
        </Link>
        <span style={{ color: 'var(--border)' }}>|</span>
        <Link
          href="/account"
          className="font-medium transition-opacity hover:opacity-80"
          style={{ color: 'var(--text-primary)' }}
        >
          Account
        </Link>
      </nav>

      <SectionHeader title="My favourites" className="mb-6" />

      {restaurants.length === 0 ? (
        <EmptyState
          title="No favourites yet"
          description="Save restaurants you like and they’ll appear here."
          action={
            <Link
              href="/"
              className="rounded-lg px-4 py-2 text-small font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            >
              Discover restaurants
            </Link>
          }
        />
      ) : (
        <>
          <ul className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pagedRestaurants.map((r) => (
            <li key={r.id} className="relative flex min-h-0">
              <RestaurantCard restaurant={r} showFavorite={false} className="w-full" />
              <div className="absolute right-2 top-2 z-10">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRemove(r.id);
                  }}
                  disabled={removingId === r.id}
                  className="min-h-[44px] rounded-lg border px-3 py-1.5 text-small font-medium transition-colors disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {removingId === r.id ? 'Removing…' : 'Remove'}
                </button>
              </div>
            </li>
          ))}
          </ul>
          {total > 0 && (
            <Pagination
              className="mt-8"
              page={page}
              total={total}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </main>
  );
}
