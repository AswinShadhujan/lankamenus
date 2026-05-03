'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api, { getAdminToken, resolvePublicMediaUrl } from '@/lib/api';
import { Restaurant } from '@/types/restaurant';
import type { FavouriteDish } from '@/types/favouriteDish';
import { RestaurantCard } from '@/components/ui/RestaurantCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { RestaurantCardSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { DishFavoriteButton } from '@/components/ui/DishFavoriteButton';
import { getRestaurantDisplayName } from '@/lib/restaurant-photo';

const PAGE_SIZE = 12;

type FavouritesTab = 'restaurants' | 'dishes';

function DishFavouriteImagePlaceholder() {
  return (
    <div
      className="flex h-full w-full items-center justify-center text-3xl opacity-90"
      aria-hidden
      style={{
        background:
          'linear-gradient(145deg, color-mix(in srgb, var(--accent-primary) 22%, var(--surface)) 0%, color-mix(in srgb, var(--border) 42%, var(--surface)) 48%, color-mix(in srgb, var(--accent-secondary) 18%, var(--surface)) 100%)',
      }}
    >
      🍽
    </div>
  );
}

function FavouriteDishCardSkeleton() {
  return (
    <div
      className="lm-card-shadow flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
      aria-hidden
    >
      <Skeleton className="aspect-[16/9] w-full shrink-0 rounded-none" />
      <div className="flex min-h-0 flex-1 flex-col space-y-2 p-4">
        <Skeleton className="h-6 w-[88%] rounded-md" />
        <Skeleton className="h-4 w-24 rounded-md" />
        <Skeleton className="h-4 w-[72%] rounded-md" />
      </div>
    </div>
  );
}

function FavouriteDishCard({
  dish,
  dishHref,
  restaurantHref,
  restaurantLabel,
  priceLabel,
  imageSrc,
  onRemove,
  removing,
}: {
  dish: FavouriteDish;
  dishHref: string;
  restaurantHref: string;
  restaurantLabel: string;
  priceLabel: string;
  imageSrc: string | null;
  onRemove: () => void;
  removing: boolean;
}) {
  return (
    <article
      className="lm-card-shadow relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border transition-all duration-200 active:scale-[0.99] md:hover:border-[color-mix(in_srgb,var(--border)_70%,var(--text-secondary))] md:hover:scale-[1.01]"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="relative w-full shrink-0 bg-[var(--border)] aspect-[16/9]">
        <Link href={dishHref} className="block h-full w-full outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent-primary)_55%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]">
          {imageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote dish URLs
            <img src={imageSrc} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
          ) : (
            <DishFavouriteImagePlaceholder />
          )}
        </Link>
        <div
          className="absolute right-2 top-2 z-10"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
          role="presentation"
        >
          <DishFavoriteButton
            isFavourited
            loading={removing}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }}
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-4">
        <Link
          href={dishHref}
          className="mb-1 block min-h-[2.5rem] outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent-primary)_55%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] rounded-sm"
        >
          <h2 className="line-clamp-2 text-h3 font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
            {dish.name}
          </h2>
        </Link>
        <p className="mb-2 text-sm font-semibold" style={{ color: 'var(--accent-secondary)' }}>
          {priceLabel}
        </p>
        <p className="mt-auto line-clamp-2 text-small" style={{ color: 'var(--text-secondary)' }}>
          <Link
            href={restaurantHref}
            className="font-medium underline-offset-2 transition-opacity hover:underline hover:opacity-90"
            style={{ color: 'var(--accent-primary)' }}
          >
            {restaurantLabel}
          </Link>
        </p>
      </div>
    </article>
  );
}

export default function FavouritesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<FavouritesTab>('restaurants');
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [restaurantsLoading, setRestaurantsLoading] = useState(true);
  const [removingRestaurantId, setRemovingRestaurantId] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  const [dishes, setDishes] = useState<FavouriteDish[]>([]);
  const [dishesLoading, setDishesLoading] = useState(false);
  const [dishesFetched, setDishesFetched] = useState(false);
  const [removingDishId, setRemovingDishId] = useState<number | null>(null);

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
    setRestaurantsLoading(true);
    api
      .get<{ data: Restaurant[] }>('/users/me/favourites')
      .then((res) => setRestaurants(res.data.data ?? []))
      .catch((err) => {
        if (err.response?.status === 401) router.replace('/login');
        else setRestaurants([]);
      })
      .finally(() => setRestaurantsLoading(false));
  }, [router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!getAdminToken()) return;
    if (activeTab !== 'dishes' || dishesFetched) return;

    let cancelled = false;
    setDishesLoading(true);
    api
      .get<{ data: FavouriteDish[] }>('/users/me/favourites/dishes')
      .then((res) => {
        if (!cancelled) setDishes(res.data.data ?? []);
      })
      .catch((err) => {
        if (err.response?.status === 401) router.replace('/login');
        else if (!cancelled) setDishes([]);
      })
      .finally(() => {
        if (!cancelled) {
          setDishesLoading(false);
          setDishesFetched(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, dishesFetched, router]);

  const handleRemoveRestaurant = (restaurantId: number) => {
    setRemovingRestaurantId(restaurantId);
    api
      .delete(`/users/me/favourites/${restaurantId}`)
      .then(() => setRestaurants((prev) => prev.filter((r) => r.id !== restaurantId)))
      .catch(() => {})
      .finally(() => setRemovingRestaurantId(null));
  };

  const handleRemoveDish = (dish: FavouriteDish, index: number) => {
    if (removingDishId != null) return;
    setRemovingDishId(dish.id);
    setDishes((prev) => prev.filter((d) => d.id !== dish.id));
    api
      .delete(`/users/me/favourites/dishes/${dish.id}`)
      .catch(() => {
        setDishes((prev) => {
          const next = [...prev];
          next.splice(Math.min(index, next.length), 0, dish);
          return next;
        });
      })
      .finally(() => setRemovingDishId(null));
  };

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

      <SectionHeader title="My Favourites" className="mb-4" />

      <div
        role="tablist"
        aria-label="Favourites type"
        className="mb-6 flex gap-8 border-b"
        style={{ borderColor: 'color-mix(in srgb, var(--border) 75%, transparent)' }}
      >
        <button
          type="button"
          role="tab"
          id="favourites-tab-restaurants"
          aria-selected={activeTab === 'restaurants'}
          aria-controls="favourites-panel-restaurants"
          tabIndex={activeTab === 'restaurants' ? 0 : -1}
          className="-mb-px border-b-2 pb-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
          style={{
            borderColor: activeTab === 'restaurants' ? 'var(--accent-primary)' : 'transparent',
            color: activeTab === 'restaurants' ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}
          onClick={() => setActiveTab('restaurants')}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') {
              e.preventDefault();
              setActiveTab('dishes');
              window.setTimeout(() => document.getElementById('favourites-tab-dishes')?.focus(), 0);
            }
          }}
        >
          Restaurants
        </button>
        <button
          type="button"
          role="tab"
          id="favourites-tab-dishes"
          aria-selected={activeTab === 'dishes'}
          aria-controls="favourites-panel-dishes"
          tabIndex={activeTab === 'dishes' ? 0 : -1}
          className="-mb-px border-b-2 pb-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
          style={{
            borderColor: activeTab === 'dishes' ? 'var(--accent-primary)' : 'transparent',
            color: activeTab === 'dishes' ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}
          onClick={() => setActiveTab('dishes')}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') {
              e.preventDefault();
              setActiveTab('restaurants');
              window.setTimeout(() => document.getElementById('favourites-tab-restaurants')?.focus(), 0);
            }
          }}
        >
          Dishes
        </button>
      </div>

      <div
        role="tabpanel"
        id="favourites-panel-restaurants"
        aria-labelledby="favourites-tab-restaurants"
        hidden={activeTab !== 'restaurants'}
      >
        {restaurantsLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <RestaurantCardSkeleton key={i} />
            ))}
          </div>
        ) : restaurants.length === 0 ? (
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
                        handleRemoveRestaurant(r.id);
                      }}
                      disabled={removingRestaurantId === r.id}
                      className="min-h-[44px] rounded-lg border px-3 py-1.5 text-small font-medium transition-colors disabled:opacity-50"
                      style={{
                        backgroundColor: 'var(--surface)',
                        borderColor: 'var(--border)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {removingRestaurantId === r.id ? 'Removing…' : 'Remove'}
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
      </div>

      <div
        role="tabpanel"
        id="favourites-panel-dishes"
        aria-labelledby="favourites-tab-dishes"
        hidden={activeTab !== 'dishes'}
      >
        {dishesLoading ? (
          <ul className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <li key={`dish-sk-${i}`} className="flex min-h-0">
                <FavouriteDishCardSkeleton />
              </li>
            ))}
          </ul>
        ) : dishes.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-14 text-center"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            <span className="mb-3 text-4xl" aria-hidden>
              🍽️
            </span>
            <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              No favourite dishes yet
            </p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed">
              Tap the ♡ on any dish to save it here
            </p>
          </div>
        ) : (
          <ul className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dishes.map((dish, index) => {
              const img = resolvePublicMediaUrl(dish.image_url);
              const dishHref = `/restaurants/${dish.restaurant_id}/menus/${dish.menu_id}/items/${dish.id}`;
              const restaurantHref = `/restaurants/${dish.restaurant_id}`;
              const restaurantLabel = getRestaurantDisplayName(dish.restaurant_name);
              const priceLabel =
                dish.price != null ? `LKR ${dish.price.toFixed(2)}` : 'LKR —';

              return (
                <li key={dish.id} className="flex min-h-0">
                  <FavouriteDishCard
                    dish={dish}
                    dishHref={dishHref}
                    restaurantHref={restaurantHref}
                    restaurantLabel={restaurantLabel}
                    priceLabel={priceLabel}
                    imageSrc={img}
                    onRemove={() => handleRemoveDish(dish, index)}
                    removing={removingDishId === dish.id}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
