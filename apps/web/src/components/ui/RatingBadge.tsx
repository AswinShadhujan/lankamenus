'use client';

type RatingBadgeProps = {
  rating: number;
  count?: number | null;
  className?: string;
};

export function RatingBadge({ rating, count, className = '' }: RatingBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-small font-semibold ${className}`}
      style={{ color: 'var(--accent-secondary)' }}
    >
      ★ {rating.toFixed(1)}
      {count != null && count > 0 && (
        <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>
          ({count})
        </span>
      )}
    </span>
  );
}
