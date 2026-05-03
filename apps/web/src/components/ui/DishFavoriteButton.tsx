'use client';

import type { MouseEvent } from 'react';

type DishFavoriteButtonProps = {
  isFavourited: boolean;
  loading?: boolean;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
};

export function DishFavoriteButton({
  isFavourited,
  loading = false,
  onClick,
  className = '',
}: DishFavoriteButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-label={isFavourited ? 'Remove dish from favourites' : 'Add dish to favourites'}
      className={`inline-flex h-8 min-h-8 min-w-8 w-8 shrink-0 items-center justify-center rounded-full border-0 text-base leading-none transition-transform active:scale-95 disabled:opacity-60 ${className}`}
      style={{
        color: '#ffffff',
        backgroundColor: isFavourited ? 'var(--accent-primary)' : 'rgba(0,0,0,0.35)',
      }}
    >
      {loading ? (
        <span className="text-sm leading-none" aria-hidden>
          ⋯
        </span>
      ) : (
        <span aria-hidden>{isFavourited ? '♥' : '♡'}</span>
      )}
    </button>
  );
}
