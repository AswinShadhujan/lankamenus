'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Restaurant, type RestaurantsListResponse } from '@/types/restaurant';
import { SearchBar } from '@/components/ui/SearchBar';
import { Pagination } from '@/components/ui/Pagination';

const PAGE_SIZE = 20;

export default function AdminRestaurantsPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  /** Input field value (does not trigger fetch until Search / Enter). */
  const [searchInput, setSearchInput] = useState('');
  /** Query sent to the API (updated on Search, Clear, or submit). */
  const [appliedQuery, setAppliedQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const trimmed = appliedQuery.trim();
    api
        .get<RestaurantsListResponse>('/restaurants', {
          params: {
            page,
            limit: PAGE_SIZE,
            ...(trimmed ? { q: trimmed } : {}),
          },
        })
      .then((res) => {
        if (!cancelled) {
          setRestaurants(res.data.data ?? []);
          setTotal(res.data.total ?? 0);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load restaurants');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, appliedQuery, refreshKey]);

  const applySearch = (q?: string) => {
    const trimmed = (q ?? searchInput).trim();
    setSearchInput(trimmed);
    setAppliedQuery(trimmed);
    setPage(1);
    setRefreshKey((k) => k + 1);
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    api
      .delete(`/restaurants/${id}`)
      .then(() => {
        const nextTotal = Math.max(0, total - 1);
        const maxPage = Math.max(1, Math.ceil(nextTotal / PAGE_SIZE));
        if (page > maxPage) {
          setPage(maxPage);
        }
        setRefreshKey((k) => k + 1);
      })
      .catch(() => setError('Failed to delete restaurant'))
      .finally(() => setDeletingId(null));
  };

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="admin-heading-1">Restaurants</h1>
        <Link href="/admin/restaurants/new" className="admin-btn-primary inline-flex w-fit">
          Add restaurant
        </Link>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:max-w-md">
          <SearchBar
            value={searchInput}
            onChange={setSearchInput}
            onSubmit={(value) => applySearch(value)}
            placeholder="Search by name, city, district…"
            aria-label="Search restaurants"
            className="w-full"
          />
        </div>

        <div className="flex gap-2">
          {searchInput && (
            <button
              type="button"
              className="admin-btn-secondary"
              onClick={() => applySearch('')}
              disabled={loading}
            >
              Clear
            </button>
          )}
          <button
            type="button"
            className="admin-btn-primary"
            onClick={() => applySearch(searchInput)}
            disabled={loading}
          >
            Search
          </button>
        </div>
      </div>

      {error && <p className="admin-text-error mb-4">{error}</p>}

      {loading ? (
        <p className="admin-text-muted">Loading…</p>
      ) : (
        <>
          <div className="admin-table-wrap overflow-x-auto">
            <table className="admin-table min-w-[640px]">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>City / District</th>
                  <th>Cuisines</th>
                  <th className="w-44">Actions</th>
                </tr>
              </thead>
              <tbody>
                {restaurants.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.name_default}</td>
                    <td>{[r.city, r.district].filter(Boolean).join(', ') || '—'}</td>
                    <td>{r.cuisine_tags?.length ? r.cuisine_tags.join(', ') : '—'}</td>
                    <td>
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        <Link href={`/admin/restaurants/${r.id}/menu`} className="admin-link">
                          Menu
                        </Link>
                        <Link href={`/admin/restaurants/${r.id}/edit`} className="admin-link">
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(r.id, r.name_default)}
                          disabled={deletingId === r.id}
                          className="admin-btn-danger-text disabled:opacity-50"
                        >
                          {deletingId === r.id ? 'Deleting…' : 'Delete'}
                        </button>
                        <Link
                          href={`/restaurants/${r.id}`}
                          className="text-small font-medium transition-opacity hover:opacity-80"
                          style={{ color: 'var(--text-secondary)' }}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View ↗
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {restaurants.length === 0 && !loading && (
              <p className="px-4 py-10 text-center text-small">No restaurants yet. Add one to get started.</p>
            )}
          </div>
          {total > 0 && (
            <Pagination
              className="mt-6"
              page={page}
              total={total}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}
