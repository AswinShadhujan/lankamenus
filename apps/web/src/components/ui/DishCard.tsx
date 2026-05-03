'use client';

import Link from 'next/link';
import { MenuItemCardThumbnail } from '@/components/restaurant/MenuItemCardThumbnail';
import { DishFavoriteButton } from '@/components/ui/DishFavoriteButton';

type DishCardProps = {
  name: string;
  description?: string | null;
  price?: number | string | null;
  veg?: boolean | null;
  imageUrl?: string | null;
  href: string;
  restaurantId: string;
  menuId: string;
  itemId: string;
  /** Favourite control on the thumbnail (from page-level `useDishFavourites`). */
  favourite?: {
    isFavourited: boolean;
    loading: boolean;
    onToggle: () => void;
  } | null;
};

function formatPrice(price: number | string | null | undefined): string | null {
  if (price == null) return null;
  const num = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(num)) return null;
  return `LKR ${num.toFixed(2)}`;
}

export function DishCard({
  name,
  description,
  price,
  veg,
  imageUrl,
  href,
  favourite = null,
}: DishCardProps) {
  const priceStr = formatPrice(price);

  return (
    <div
      className="flex items-start justify-between gap-4 rounded-lg border p-4 transition-colors duration-200 hover:bg-[var(--surface)]"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}
    >
      <div className="relative shrink-0">
        <MenuItemCardThumbnail url={imageUrl} alt={name} size="compact" />
        {favourite ? (
          <div
            className="absolute -right-1 -top-1 z-[2]"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
            role="presentation"
          >
            <DishFavoriteButton
              isFavourited={favourite.isFavourited}
              loading={favourite.loading}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void favourite.onToggle();
              }}
            />
          </div>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <Link href={href} className="block">
          <span className="text-body font-medium" style={{ color: 'var(--text-primary)' }}>
            {name}
          </span>
        </Link>
        {veg && (
          <span className="ml-2 text-small">Veg</span>
        )}
        {description != null && description !== '' && (
          <p className="text-small mt-0.5 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
            {description}
          </p>
        )}
      </div>
      {priceStr != null && (
        <span
          className="shrink-0 font-semibold"
          style={{ color: 'var(--accent-secondary)' }}
        >
          {priceStr}
        </span>
      )}
    </div>
  );
}
