'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api, { getAdminToken } from '@/lib/api';
import { useDishFavourites } from '@/hooks/useDishFavourites';
import { resolveDishDisplayImageUrl } from '@/lib/dish-image';
import { parseIngredientParts } from '@/lib/menu-ingredients';
import { DishDetail, type Menu, type MenuItem } from '@/types/menu';
import { RatingBadge } from '@/components/ui/RatingBadge';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { DishCard } from '@/components/ui/DishCard';
import { DishFavoriteButton } from '@/components/ui/DishFavoriteButton';

function formatPrice(price: number | string | null | undefined): string | null {
  if (price == null) return null;
  const num = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(num)) return null;
  return num.toFixed(2);
}

export default function DishDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const menuId = params?.menuId as string;
  const itemId = params?.itemId as string;

  const [dish, setDish] = useState<DishDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [relatedItems, setRelatedItems] = useState<MenuItem[]>([]);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    setHasToken(!!getAdminToken());
  }, []);

  const dishFavourites = useDishFavourites(hasToken);

  useEffect(() => {
    if (!menuId || !itemId) {
      setLoading(false);
      setError('Invalid link');
      return;
    }

    setLoading(true);
    setError(null);
    api
      .get<DishDetail>(`/menus/${menuId}/items/${itemId}`)
      .then((res) => {
        setDish(res.data);
        setImageError(false);
      })
      .catch((err) => {
        if (err.response?.status === 404) {
          setError('Dish not found');
        } else {
          setError('Failed to load dish');
        }
        if (process.env.NODE_ENV === 'development') console.error(err);
      })
      .finally(() => setLoading(false));
  }, [menuId, itemId]);

  useEffect(() => {
    if (!menuId || !dish) {
      setRelatedItems([]);
      return;
    }
    let cancelled = false;
    api
      .get<Menu>(`/menus/${menuId}`)
      .then((res) => {
        if (cancelled) return;
        const all: MenuItem[] =
          res.data.menu_sections?.flatMap((s) => s.menu_items ?? []) ?? [];
        const others = all.filter((it) => String(it.id) !== String(dish.id)).slice(0, 8);
        setRelatedItems(others);
      })
      .catch(() => {
        if (!cancelled) setRelatedItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [menuId, dish?.id]);

  const goFullMenu = () => {
    if (dish) router.push(`/restaurants/${dish.restaurant_id}`);
  };

  const ingredientParts = useMemo(
    () => (dish ? parseIngredientParts(dish.ingredients) : []),
    [dish],
  );

  if (loading) {
    return (
      <div className="min-h-screen pb-8 transition-colors duration-200" style={{ backgroundColor: 'var(--background)' }}>
        <main className="mx-auto max-w-3xl space-y-6 py-6 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] sm:pl-6 sm:pr-6">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-[320px] w-full rounded-2xl" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-5 w-24" />
        </main>
      </div>
    );
  }

  if (error || !dish) {
    return (
      <div className="min-h-screen pb-8 transition-colors duration-200" style={{ backgroundColor: 'var(--background)' }}>
        <main className="mx-auto max-w-3xl space-y-6 py-6 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] sm:pl-6 sm:pr-6">
          <ErrorState message={error ?? 'Dish not found'} />
          <div className="flex flex-wrap gap-4">
            {id ? (
              <Link
                href={`/restaurants/${id}`}
                className="text-sm font-medium underline-offset-2 hover:underline"
                style={{ color: 'var(--accent-primary)' }}
              >
                ← Back to restaurant
              </Link>
            ) : null}
            <Link
              href="/"
              className="text-sm font-medium underline-offset-2 hover:underline"
              style={{ color: 'var(--accent-primary)' }}
            >
              ← Back to restaurants
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const priceFormatted = formatPrice(dish.price);
  const resolvedImage = resolveDishDisplayImageUrl(dish);
  const imageSrc = resolvedImage && !imageError ? resolvedImage : null;
  const isPopular = !!dish.is_popular;
  const isRecommended = !!dish.is_recommended;
  const isAvailable = dish.is_available !== false;

  return (
    <div
      className="relative min-h-screen pb-8 transition-colors duration-200"
      style={{ backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}
    >
      <main className="mx-auto max-w-3xl space-y-6 py-6 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] sm:pl-6 sm:pr-6">
        <nav
          className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs leading-snug sm:text-sm"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Link
            href="/"
            className="inline-flex min-h-[40px] min-w-[40px] shrink-0 items-center transition-opacity hover:opacity-80"
            style={{ color: 'var(--accent-primary)' }}
          >
            Restaurants
          </Link>
          <span className="mx-0.5 shrink-0 sm:mx-2" aria-hidden>
            /
          </span>
          <Link
            href={`/restaurants/${dish.restaurant_id}`}
            className="min-w-0 max-w-[min(100%,14rem)] truncate text-left transition-opacity hover:opacity-80 sm:max-w-[20rem]"
            style={{ color: 'var(--accent-primary)' }}
            title={dish.restaurant_name}
          >
            {dish.restaurant_name}
          </Link>
          <span className="mx-0.5 shrink-0 sm:mx-2" aria-hidden>
            /
          </span>
          <span className="min-w-0 flex-1 break-words sm:flex-none sm:max-w-md" style={{ color: 'var(--text-primary)' }}>
            {dish.name}
          </span>
        </nav>

        <div className="relative overflow-hidden rounded-2xl">
          {imageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote dish URLs
            <img
              src={imageSrc}
              alt={dish.name}
              className="h-[220px] w-full object-cover sm:h-[320px]"
              onError={() => setImageError(true)}
            />
          ) : (
            <div
              className="flex h-[220px] w-full items-center justify-center text-5xl opacity-40 sm:h-[320px]"
              style={{ backgroundColor: 'var(--border)' }}
            >
              🍽
            </div>
          )}

          <div className="absolute right-2 top-2 z-[3] sm:right-3 sm:top-3">
            <DishFavoriteButton
              isFavourited={dishFavourites.isFavourited(dish.id)}
              loading={dishFavourites.loadingDishId === dish.id}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void dishFavourites.toggle(dish.id);
              }}
            />
          </div>

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

          <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4">
            <h1 className="text-xl font-semibold text-white sm:text-2xl">{dish.name}</h1>

            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {isPopular && (
                  <span className="rounded-full bg-orange-500/90 px-2 py-1 text-xs text-white shadow">
                    🔥 Popular
                  </span>
                )}

                {isRecommended && (
                  <span className="rounded-full bg-purple-500/90 px-2 py-1 text-xs text-white shadow">
                    ⭐ Recommended
                  </span>
                )}

                {isAvailable && (
                  <span className="rounded-full bg-green-500/90 px-2 py-1 text-xs text-white shadow">
                    ● Available
                  </span>
                )}

                {!isAvailable && (
                  <span className="rounded-full bg-red-500/90 px-2 py-1 text-xs text-white shadow">
                    ● Unavailable
                  </span>
                )}

                {dish.veg ? (
                  <span
                    className="rounded-full border px-2 py-1 text-xs text-white shadow-sm"
                    style={{ borderColor: 'color-mix(in srgb, white 45%, transparent)', backgroundColor: 'rgba(0,0,0,0.25)' }}
                  >
                    Vegetarian
                  </span>
                ) : null}
              </div>

              <span className="text-base font-semibold sm:text-lg" style={{ color: 'var(--accent-secondary)' }}>
                {priceFormatted != null ? `LKR ${priceFormatted}` : 'LKR —'}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <h3 className="text-xs font-semibold uppercase" style={{ color: 'var(--text-secondary)' }}>
            About this dish
          </h3>

          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
            {dish.description?.trim() ||
              'A delicious dish prepared with fresh ingredients and authentic flavors.'}
          </p>
        </div>

        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {dish.section} · {dish.menu_name}
        </p>

        {dish.rating != null && (
          <div>
            <RatingBadge rating={dish.rating} count={dish.rating_count} />
          </div>
        )}

        {ingredientParts.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase" style={{ color: 'var(--text-secondary)' }}>
              Ingredients
            </h3>
            <ul className="flex flex-wrap gap-2">
              {ingredientParts.map((ing, idx) => (
                <li
                  key={`${idx}-${ing}`}
                  className="rounded-lg border px-3 py-1.5 text-sm"
                  style={{
                    borderColor: 'var(--border)',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {ing}
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          type="button"
          onClick={goFullMenu}
          className="mt-6 flex min-h-[48px] w-full cursor-pointer items-center justify-center rounded-xl px-4 py-3 text-center text-sm font-medium text-white transition-opacity hover:opacity-95 active:opacity-90"
          style={{ backgroundColor: 'var(--accent-primary)' }}
        >
          <span className="line-clamp-2">View full menu · {dish.restaurant_name}</span>
        </button>

        <div className="space-y-3">
          <h3 className="mt-8 mb-3 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            More from this restaurant
          </h3>
          <div className="space-y-3">
            {relatedItems.map((item) => (
              <DishCard
                key={item.id}
                name={item.name}
                description={item.description}
                price={item.price}
                veg={item.veg}
                imageUrl={resolveDishDisplayImageUrl(item)}
                href={`/restaurants/${dish.restaurant_id}/menus/${menuId}/items/${item.id}`}
                restaurantId={String(dish.restaurant_id)}
                menuId={String(menuId)}
                itemId={String(item.id)}
                favourite={{
                  isFavourited: dishFavourites.isFavourited(item.id),
                  loading: dishFavourites.loadingDishId === item.id,
                  onToggle: () => void dishFavourites.toggle(item.id),
                }}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
