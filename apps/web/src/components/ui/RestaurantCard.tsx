'use client';

import Link from 'next/link';
import type { Restaurant } from '@/types/restaurant';
import { RatingBadge } from './RatingBadge';
import { FavoriteButton } from './FavoriteButton';
import { RestaurantPhotoImage } from './RestaurantPhotoImage';
import { RestaurantCategoryChips } from '@/components/restaurant/RestaurantCategoryChips';

type RestaurantCardProps = {
  restaurant: Restaurant;
  isFavorite?: boolean;
  favoriteLoading?: boolean;
  onFavoriteClick?: () => void;
  showFavorite?: boolean;
  /** Compact card for horizontal discovery rails; full-width grid uses default. */
  variant?: 'default' | 'rail';
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

  return (
    <article
      className={`overflow-hidden rounded-xl border transition-colors duration-200 active:scale-[0.99] md:hover:border-[color-mix(in_srgb,var(--border)_70%,var(--text-secondary))] md:hover:scale-[1.01] ${isRail ? 'max-w-[280px]' : 'flex h-full min-h-0 w-full flex-col'} ${className}`}
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--border)',
      }}
    >
      <Link
        href={`/restaurants/${restaurant.id}`}
        className={`${isRail ? 'block' : 'flex h-full min-h-0 min-w-0 flex-col'}`}
      >
        <div
          className={`relative w-full shrink-0 bg-[var(--border)] ${isRail ? 'aspect-[4/3]' : 'aspect-[16/9]'}`}
        >
          <RestaurantPhotoImage
            restaurant={restaurant}
            alt=""
            className="h-full w-full object-cover"
          />
          {showFavorite && onFavoriteClick && (
            <div
              className={`absolute right-2 top-2 ${isRail ? 'scale-90' : ''}`}
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
          className={`flex flex-1 flex-col ${isRail ? 'p-3' : 'min-h-[7.25rem] p-4'}`}
        >
          <h2
            className={`mb-1 line-clamp-2 min-h-[2.5rem] font-semibold ${isRail ? 'text-base leading-snug' : 'text-h3'}`}
            style={{ color: 'var(--text-primary)' }}
          >
            {restaurant.name_default}
          </h2>
          <div className={`flex min-h-[1.35rem] flex-wrap items-center gap-1.5 ${isRail ? 'mb-1' : 'mb-2'}`}>
            {restaurant.rating != null && (
              <RatingBadge rating={restaurant.rating} className={isRail ? 'text-xs' : ''} />
            )}
            <RestaurantCategoryChips
              tags={restaurant.cuisine_tags}
              size={isRail ? 'sm' : 'sm'}
              maxKnown={isRail ? 2 : 4}
              showUnknown={false}
              className="min-w-0 flex-1 gap-1"
            />
          </div>
          <div className={`mt-auto space-y-0.5 ${isRail ? 'text-xs' : 'text-small'}`}>
            {restaurant.distance_km != null ? (
              <p style={{ color: 'var(--text-secondary)' }}>
                {restaurant.distance_km.toFixed(1)} km away
              </p>
            ) : (
              !isRail && <p className="invisible select-none" aria-hidden="true">—</p>
            )}
            {(restaurant.city ?? restaurant.district) ? (
              <p className="line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                {[restaurant.city, restaurant.district].filter(Boolean).join(', ')}
              </p>
            ) : (
              !isRail && <p className="invisible select-none" aria-hidden="true">—</p>
            )}
          </div>
        </div>
      </Link>
    </article>
  );
}
