'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import api, { getAdminToken } from '@/lib/api';
import { Restaurant } from '@/types/restaurant';
import { MenuListItem } from '@/types/menu';
import { RatingBadge } from '@/components/ui/RatingBadge';
import { FavoriteButton } from '@/components/ui/FavoriteButton';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { RestaurantPhotoImage } from '@/components/ui/RestaurantPhotoImage';
import {
  MenuMenuSkeleton,
  RestaurantMenuExperience,
} from '@/components/restaurant/RestaurantMenuExperience';
import { RestaurantCategoryChips } from '@/components/restaurant/RestaurantCategoryChips';
import type { Menu } from '@/types/menu';

type TabId = 'menu' | 'photos' | 'reviews';

export default function RestaurantDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menus, setMenus] = useState<MenuListItem[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('menu');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [isFavourite, setIsFavourite] = useState(false);
  const [favouriteLoading, setFavouriteLoading] = useState(false);
  useEffect(() => {
    setHasToken(!!getAdminToken());
  }, []);

  useEffect(() => {
    if (!hasToken || !id) return;
    api
      .get<{ data: Restaurant[] }>('/users/me/favourites')
      .then((res) => {
        const list = res.data.data ?? [];
        setIsFavourite(list.some((r) => r.id === parseInt(id, 10)));
      })
      .catch(() => {});
  }, [hasToken, id]);

  const handleToggleFavourite = () => {
    if (!restaurant || favouriteLoading) return;
    const restaurantId = restaurant.id;
    setFavouriteLoading(true);
    if (isFavourite) {
      api
        .delete(`/users/me/favourites/${restaurantId}`)
        .then(() => setIsFavourite(false))
        .catch(() => {})
        .finally(() => setFavouriteLoading(false));
    } else {
      api
        .post('/users/me/favourites', { restaurantId })
        .then(() => setIsFavourite(true))
        .catch(() => {})
        .finally(() => setFavouriteLoading(false));
    }
  };

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    setError(null);

    Promise.all([
      api.get<Restaurant>(`/restaurants/${id}`),
      api.get<MenuListItem[]>(`/restaurants/${id}/menus`),
    ])
      .then(async ([restRes, menusRes]) => {
        setRestaurant(restRes.data);
        const menuList = Array.isArray(menusRes.data) ? menusRes.data : [];
        setMenus(menuList);

        if (menuList.length === 0) {
          setSelectedMenu(null);
          return;
        }

        /** Lowest menu id is not always the one with content; pick first (by list order) that has sections. */
        const settled = await Promise.allSettled(
          menuList.map((m) => api.get<Menu>(`/menus/${m.id}`).then((r) => r.data)),
        );
        const loaded: Menu[] = [];
        for (const s of settled) {
          if (s.status === 'fulfilled') loaded.push(s.value);
        }
        if (loaded.length === 0) {
          setSelectedMenu(null);
          return;
        }
        const withSections = loaded.find((m) => (m.menu_sections?.length ?? 0) > 0);
        setSelectedMenu(withSections ?? loaded[0]);
      })
      .catch((err) => {
        if (err.response?.status === 404) {
          setError('Restaurant not found');
        } else {
          setError('Failed to load restaurant');
        }
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:max-w-5xl">
        <Skeleton className="mb-4 h-6 w-32" />
        <Skeleton className="aspect-[21/9] w-full rounded-xl" />
        <Skeleton className="mt-6 h-8 w-3/4" />
        <Skeleton className="mt-2 h-4 w-1/2" />
        <div className="mt-8 flex gap-2 border-b border-[var(--border)] pb-2">
          <Skeleton className="h-9 w-16 rounded-md" />
          <Skeleton className="h-9 w-16 rounded-md" />
          <Skeleton className="h-9 w-20 rounded-md" />
        </div>
        <h2 className="mt-6 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Menu
        </h2>
        <MenuMenuSkeleton />
      </main>
    );
  }

  if (error || !restaurant) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:max-w-5xl">
        <ErrorState message={error ?? 'Restaurant not found'} />
        <Link
          href="/"
          className="mt-4 inline-block text-small font-medium transition-opacity hover:opacity-80"
          style={{ color: 'var(--accent-primary)' }}
        >
          ← Back to restaurants
        </Link>
      </main>
    );
  }

  const category = restaurant.cuisine_tags?.join(', ') ?? '—';
  const location = [restaurant.city, restaurant.district].filter(Boolean).join(', ');

  const tabs: { id: TabId; label: string }[] = [
    { id: 'menu', label: 'Menu' },
    { id: 'photos', label: 'Photos' },
    { id: 'reviews', label: 'Reviews' },
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:max-w-5xl">
      <Link
        href="/"
        className="mb-4 inline-block text-small font-medium transition-opacity hover:opacity-80"
        style={{ color: 'var(--text-secondary)' }}
      >
        ← Back to restaurants
      </Link>

      <div className="relative mb-6 aspect-[21/9] w-full overflow-hidden rounded-xl bg-[var(--border)]">
        <RestaurantPhotoImage
          restaurant={restaurant}
          alt=""
          className="h-full w-full object-cover"
        />
      </div>

      <header className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-h1" style={{ color: 'var(--text-primary)' }}>
              {restaurant.name_default}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {restaurant.rating != null && (
                <RatingBadge rating={restaurant.rating} />
              )}
              {restaurant.cuisine_tags?.length ? (
                <RestaurantCategoryChips
                  tags={restaurant.cuisine_tags}
                  size="sm"
                  showUnknown
                  className="gap-1.5 sm:gap-2"
                />
              ) : (
                <span className="text-small" style={{ color: 'var(--text-secondary)' }}>
                  —
                </span>
              )}
            </div>
            {location && (
              <p className="mt-1 text-small" style={{ color: 'var(--text-secondary)' }}>
                {location}
              </p>
            )}
            {restaurant.address_line1 && (
              <p className="text-small" style={{ color: 'var(--text-secondary)' }}>
                {restaurant.address_line1}
              </p>
            )}
            <p className="mt-1 text-small" style={{ color: 'var(--text-secondary)' }}>
              Price level: {restaurant.price_level ?? '—'} · Veg: {restaurant.veg_friendly ? 'Yes' : 'No'} · Halal:{' '}
              {restaurant.halal_certified ? 'Yes' : 'No'}
            </p>
          </div>
          <div className="shrink-0">
            {hasToken ? (
              <FavoriteButton
                isFavorite={isFavourite}
                loading={favouriteLoading}
                onClick={handleToggleFavourite}
              />
            ) : (
              <Link
                href="/login"
                className="inline-block rounded-lg border px-4 py-2 text-small font-medium transition-colors"
                style={{
                  borderColor: 'var(--border)',
                  color: 'var(--text-secondary)',
                }}
              >
                Log in to save favourites
              </Link>
            )}
          </div>
        </div>
      </header>

      <nav className="mb-6 flex gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className="border-b-2 px-4 py-2 text-small font-medium transition-colors"
            style={{
              borderColor: activeTab === tab.id ? 'var(--accent-primary)' : 'transparent',
              color: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'menu' && (
        <section>
          <SectionHeader title="Menu" className="mb-4" />
          <RestaurantMenuExperience
            restaurantIdParam={id}
            menu={selectedMenu}
            noMenuAvailable={menus.length === 0}
          />
        </section>
      )}

      {activeTab === 'photos' && (
        <section>
          <p className="text-small" style={{ color: 'var(--text-secondary)' }}>
            Photos coming soon.
          </p>
        </section>
      )}

      {activeTab === 'reviews' && (
        <section>
          <p className="text-small" style={{ color: 'var(--text-secondary)' }}>
            Reviews coming soon.
          </p>
        </section>
      )}
    </main>
  );
}
