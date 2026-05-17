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
import type { Menu } from '@/types/menu';
import { buildGoogleMapsRestaurantUrl } from '@/lib/buildGoogleMapsRestaurantUrl';
import { normalizeRestaurantCategories } from '@/lib/foodCategories';
import { RestaurantDetailMobileInfo } from '@/components/restaurant/RestaurantDetailMobileInfo';
import { RestaurantDetailDesktopInfo } from '@/components/restaurant/RestaurantDetailDesktopInfo';
import { RestaurantDirectionsLink } from '@/components/restaurant/RestaurantDirectionsLink';

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
      <main className="mx-auto max-w-3xl py-6 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] text-black sm:pl-6 sm:pr-6 lg:max-w-5xl">
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
      <main className="mx-auto max-w-3xl py-6 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] text-black sm:pl-6 sm:pr-6 lg:max-w-5xl">
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

  const googleMapsUrl = buildGoogleMapsRestaurantUrl(restaurant);
  const heroCuisineTags = normalizeRestaurantCategories(
    Array.isArray(restaurant.cuisine_tags) ? restaurant.cuisine_tags : [],
  );

  return (
    <main className="mx-auto max-w-3xl py-6 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] text-black sm:pl-6 sm:pr-6 lg:max-w-5xl">
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
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-20 bg-gradient-to-t from-black/45 to-transparent" aria-hidden />

        {heroCuisineTags.length > 0 ? (
          <div className="absolute bottom-3 left-3 z-[2] flex max-w-[85%] flex-wrap gap-1.5 sm:bottom-4 sm:left-4">
            {heroCuisineTags.map((label) => (
              <span
                key={label}
                className="rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.22)',
                  border: '1px solid rgba(255, 255, 255, 0.35)',
                  backdropFilter: 'blur(6px)',
                }}
              >
                {label}
              </span>
            ))}
          </div>
        ) : null}

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
        <div className="min-w-0 md:hidden">
          <div className="flex items-center justify-between gap-2">
              <h1
                className="min-w-0 flex-1 text-lg font-semibold leading-snug tracking-tight"
                style={{
                  color: '#000000',
                  fontFamily: 'var(--font-display, var(--font-sans))',
                  wordBreak: 'break-word',
                }}
              >
                {restaurant.name_default}
              </h1>
              <RestaurantDirectionsLink googleMapsUrl={googleMapsUrl} />
            </div>
          {restaurant.rating != null ? (
            <div className="mt-1.5">
              <RatingBadge rating={restaurant.rating} />
            </div>
          ) : null}
        </div>
        <RestaurantDetailDesktopInfo restaurant={restaurant} googleMapsUrl={googleMapsUrl} />
      </header>

      <RestaurantDetailMobileInfo restaurant={restaurant} />

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
