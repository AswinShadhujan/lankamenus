'use client';

import Link from 'next/link';
import type { Restaurant } from '@/types/restaurant';
import { RatingBadge } from './RatingBadge';
import { FavoriteButton } from './FavoriteButton';
import { RestaurantPhotoImage } from './RestaurantPhotoImage';
import { RestaurantCategoryChips } from '@/components/restaurant/RestaurantCategoryChips';
import { getRestaurantDisplayName } from '@/lib/restaurant-photo';

type RestaurantCardProps = {
  restaurant: Restaurant;
  isFavorite?: boolean;
  favoriteLoading?: boolean;
  onFavoriteClick?: () => void;
  showFavorite?: boolean;
  /** `rail` — horizontal carousels; `compact` — denser homepage / grid listings. */
  variant?: 'default' | 'rail' | 'compact';
  className?: string;
};

export function RestaurantCard({
  restaurant,
  isFavorite = false,
  favoriteLoading = false,
  onFavoriteClick,
  showFavorite = true,
  variant = 'default',
  className = '',
}: RestaurantCardProps) {
  const isRail = variant === 'rail';
  const isCompact = variant === 'compact';

  return (
    <article
      className={`lm-card-shadow flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border transition-all duration-200 active:scale-[0.99] md:hover:border-[color-mix(in_srgb,var(--border)_70%,var(--text-secondary))] md:hover:scale-[1.01] ${className}`}
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--border)',
      }}
    >
      <Link
        href={`/restaurants/${restaurant.id}`}
        className="flex h-full min-h-0 min-w-0 flex-1 flex-col"
      >
        <div
          className={`relative w-full shrink-0 bg-[var(--border)] ${
            isRail ? 'aspect-[16/10]' : isCompact ? 'aspect-[2/1]' : 'aspect-[16/9]'
          }`}
        >
          <RestaurantPhotoImage
            restaurant={restaurant}
            alt=""
            className="h-full w-full object-cover"
          />
          {showFavorite && onFavoriteClick && (
            <div
              className={`absolute right-2 top-2 ${isRail || isCompact ? 'scale-90' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
              role="presentation"
            >
              <FavoriteButton
                isFavorite={isFavorite}
                loading={favoriteLoading}
                onClick={(e) => {
                  e?.preventDefault();
                  e?.stopPropagation();
                  onFavoriteClick();
                }}
              />
            </div>
          )}
        </div>
        <div
          className={`flex min-h-0 flex-1 flex-col ${
            isRail ? 'p-3' : isCompact ? 'min-h-[5rem] p-3' : 'min-h-[7.25rem] p-4'
          }`}
        >
          <h2
            className={`mb-1 font-semibold ${
              isRail
                ? 'line-clamp-2 h-[2.5rem] text-base leading-snug'
                : isCompact
                  ? 'line-clamp-2 min-h-[2.125rem] text-sm leading-snug sm:text-base'
                  : 'line-clamp-2 min-h-[2.5rem] text-h3'
            }`}
            style={{ color: 'var(--text-primary)' }}
          >
            {getRestaurantDisplayName(restaurant.name_default)}
          </h2>
          <div
            className={`flex items-center gap-1.5 overflow-hidden ${
              isRail
                ? 'mb-1 h-6 shrink-0'
                : isCompact
                  ? 'mb-1 min-h-[1.125rem] flex-wrap'
                  : 'mb-2 min-h-[1.35rem] flex-wrap'
            }`}
          >
            {restaurant.rating != null && (
              <RatingBadge
                rating={restaurant.rating}
                className={`shrink-0 ${isRail || isCompact ? 'text-xs' : ''}`}
              />
            )}
            <RestaurantCategoryChips
              tags={restaurant.cuisine_tags}
              size="sm"
              maxKnown={isRail ? 2 : isCompact ? 2 : 4}
              showUnknown={false}
              nowrap={isRail}
              className={isRail ? 'min-w-0 flex-1' : 'min-w-0 flex-1 gap-1'}
            />
          </div>
          <div
            className={`mt-auto space-y-0.5 ${
              isRail
                ? 'min-h-[2.5rem] text-[13px]'
                : isCompact
                  ? 'min-h-[1.875rem] text-xs'
                  : 'text-small'
            }`}
          >
            {restaurant.distance_km != null ? (
              <p
                className={isRail || isCompact ? 'line-clamp-1' : ''}
                style={{ color: 'var(--text-secondary)' }}
              >
                {restaurant.distance_km.toFixed(1)} km away
              </p>
            ) : isRail || isCompact ? (
              <p className="invisible h-[1rem] select-none leading-tight" aria-hidden="true">
                —
              </p>
            ) : (
              <p className="invisible select-none" aria-hidden="true">
                —
              </p>
            )}
            {(restaurant.city ?? restaurant.district) ? (
              <p
                className={
                  isRail || isCompact ? 'line-clamp-1' : 'line-clamp-2'
                }
                style={{ color: 'var(--text-secondary)' }}
              >
                {[restaurant.city, restaurant.district].filter(Boolean).join(', ')}
              </p>
            ) : isRail || isCompact ? (
              <p className="invisible h-[1rem] select-none leading-tight" aria-hidden="true">
                —
              </p>
            ) : (
              <p className="invisible select-none" aria-hidden="true">
                —
              </p>
            )}
          </div>
        </div>
      </Link>
    </article>
  );
}
