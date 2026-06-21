import { formatDishRailAmount } from '@/lib/dish-price';

type DishRailPriceProps = {
  price: number | null;
  currency?: string;
  hasPortions?: boolean;
  className?: string;
};

/**
 * Rail / grid dish card price — prefixes with "from" when the dish has portion sizes.
 */
export function DishRailPrice({
  price,
  currency = 'LKR',
  hasPortions = false,
  className = 'text-sm font-semibold leading-tight',
}: DishRailPriceProps) {
  if (price == null) {
    return (
      <p className={`invisible h-[1.125rem] select-none text-sm leading-tight ${className}`} aria-hidden>
        —
      </p>
    );
  }

  const c = currency.trim().toUpperCase() || 'LKR';
  const amountStr = formatDishRailAmount(price);

  if (hasPortions) {
    return (
      <p className={className} style={{ color: 'var(--accent-secondary)', fontWeight: 600 }}>
        <span
          className="text-[10px] font-normal sm:text-xs"
          style={{ color: 'var(--text-secondary)' }}
        >
          from{' '}
        </span>
        {c} {amountStr}
      </p>
    );
  }

  return (
    <p className={className} style={{ color: 'var(--accent-secondary)', fontWeight: 600 }}>
      {c} {Number(price).toLocaleString()}
    </p>
  );
}
