'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api, { getAdminToken } from '@/lib/api';
import { Restaurant } from '@/types/restaurant';
import { MenuListItem } from '@/types/menu';
import { RatingBadge } from '@/components/ui/RatingBadge';
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
import { buildGoogleMapsRestaurantUrl } from '@/lib/buildGoogleMapsRestaurantUrl';

export default function RestaurantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menus, setMenus] = useState<MenuListItem[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(null);
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

  const handleFavouriteClick = () => {
    if (!restaurant || favouriteLoading) return;
    if (!hasToken) {
      router.push('/login');
      return;
    }
    const restaurantId = restaurant.id;
    const prev = isFavourite;
    setIsFavourite(!prev);
    setFavouriteLoading(true);
    const fail = () => setIsFavourite(prev);
    if (prev) {
      api.delete(`/users/me/favourites/${restaurantId}`).catch(fail).finally(() => setFavouriteLoading(false));
    } else {
      api.post('/users/me/favourites', { restaurantId }).catch(fail).finally(() => setFavouriteLoading(false));
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
        if (process.env.NODE_ENV === 'development') console.error(err);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl py-6 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] sm:pl-6 sm:pr-6 lg:max-w-5xl">
        <Skeleton className="mb-4 h-6 w-32" />
        <Skeleton className="aspect-[21/9] w-full rounded-xl" />
        <Skeleton className="mt-6 h-8 w-3/4" />
        <Skeleton className="mt-2 h-4 w-1/2" />
        <h2 className="mt-8 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Menu
        </h2>
        <MenuMenuSkeleton />
      </main>
    );
  }

  if (error || !restaurant) {
    return (
      <main className="mx-auto max-w-3xl py-6 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] sm:pl-6 sm:pr-6 lg:max-w-5xl">
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

  const location = [restaurant.city, restaurant.district].filter(Boolean).join(', ');
  const googleMapsUrl = buildGoogleMapsRestaurantUrl(restaurant);

  return (
    <main className="mx-auto max-w-3xl py-6 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] sm:pl-6 sm:pr-6 lg:max-w-5xl">
      <Link
        href="/"
        className="mb-4 inline-flex min-h-[44px] items-center text-small font-medium transition-opacity hover:opacity-80"
        style={{ color: 'var(--text-secondary)' }}
      >
        ← Back to restaurants
      </Link>

      <div className="relative mb-6 aspect-[16/9] w-full max-w-full overflow-hidden rounded-xl bg-[var(--border)] sm:aspect-[21/9]">
        <RestaurantPhotoImage
          restaurant={restaurant}
          alt=""
          className="h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-28 bg-gradient-to-b from-black/50 to-transparent" aria-hidden />

        <div className="absolute right-3 top-3 z-[2] flex flex-col items-center gap-0.5 sm:right-4 sm:top-4">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              handleFavouriteClick();
            }}
            disabled={Boolean(hasToken && favouriteLoading)}
            aria-label={
              hasToken ? (isFavourite ? 'Remove from favourites' : 'Add to favourites') : 'Log in to save restaurant'
            }
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border-0 text-lg leading-none shadow-sm transition-[transform] active:scale-95 disabled:opacity-55"
            style={{
              color: '#ffffff',
              backgroundColor:
                hasToken && isFavourite ? 'var(--accent-primary)' : 'rgba(0,0,0,0.35)',
            }}
          >
            {hasToken && favouriteLoading ? (
              <span className="text-base leading-none" aria-hidden>
                ⋯
              </span>
            ) : (
              <span aria-hidden>{hasToken && isFavourite ? '♥' : '♡'}</span>
            )}
          </button>
          {!hasToken ? (
            <span
              className="text-[0.75rem] font-medium drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              Save
            </span>
          ) : null}
        </div>
      </div>

      <header className="mb-6">
        <div className="min-w-0">
            <h1
              className="leading-tight"
              style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-display, var(--font-sans))',
                wordBreak: 'break-word',
              }}
            >
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
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <span
                className="inline-flex items-center gap-1"
                style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}
                aria-label={restaurant.veg_friendly ? 'Vegetarian friendly' : 'Not vegetarian friendly'}
              >
                Veg {restaurant.veg_friendly ? '✅' : '❌'}
              </span>
              <span
                className="inline-flex items-center gap-1"
                style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}
                aria-label={restaurant.halal_certified ? 'Halal certified' : 'Not halal certified'}
              >
                Halal {restaurant.halal_certified ? '✅' : '❌'}
              </span>
            </div>
            {restaurant.price_level != null && (
              <p className="mt-1 text-xs sm:text-small" style={{ color: 'var(--text-secondary)' }}>
                Price: {restaurant.price_level}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open in Google Maps"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '9999px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  textDecoration: 'none',
                  transition: 'border-color 0.15s ease',
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                Directions
              </a>
            </div>
        </div>
      </header>

      {restaurant.restaurant_extra_costs != null &&
        restaurant.restaurant_extra_costs.length > 0 && (
          <div
            className="mb-6 rounded-xl border px-4 py-3"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
          >
            <p
              className="mb-2 text-xs font-semibold uppercase tracking-wide"
              style={{ color: 'var(--text-secondary)' }}
            >
              Extra costs
            </p>
            <ul className="space-y-1">
              {restaurant.restaurant_extra_costs.map((cost) => (
                <li
                  key={cost.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span style={{ color: 'var(--text-primary)' }}>{cost.label}</span>
                  <span
                    className="font-medium tabular-nums"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {Number(cost.rate)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

      <section>
        <SectionHeader title="Menu" className="mb-4" />
        <RestaurantMenuExperience
          restaurantIdParam={id}
          menu={selectedMenu}
          noMenuAvailable={menus.length === 0}
        />
      </section>
    </main>
  );
}
