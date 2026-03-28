'use client';

type FavoriteButtonProps = {
  isFavorite: boolean;
  loading?: boolean;
  onClick: (e?: React.MouseEvent) => void;
  className?: string;
  'aria-label'?: string;
};

export function FavoriteButton({
  isFavorite,
  loading = false,
  onClick,
  className = '',
  'aria-label': ariaLabel,
}: FavoriteButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-label={ariaLabel ?? (isFavorite ? 'Remove from favourites' : 'Add to favourites')}
      className={`rounded-full p-2 transition-transform duration-200 active:scale-95 disabled:opacity-50 md:hover:scale-110 ${className}`}
      style={{
        color: isFavorite ? 'var(--accent-primary)' : 'var(--text-secondary)',
      }}
    >
      {loading ? (
        <span className="text-lg">⋯</span>
      ) : (
        <span className="text-xl">{isFavorite ? '❤️' : '🤍'}</span>
      )}
    </button>
  );
}
