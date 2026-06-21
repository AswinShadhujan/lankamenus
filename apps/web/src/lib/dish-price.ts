/** Whole-number amount for rail cards (e.g. 1000 → "1,000"). */
export function formatDishRailAmount(price: number): string {
  return price.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

/** Standard dish price string with 2 decimals. */
export function formatDishPriceFull(
  price: number | string | null | undefined,
  currency = 'LKR',
): string | null {
  if (price == null) return null;
  const num = typeof price === 'string' ? parseFloat(price) : price;
  if (Number.isNaN(num)) return null;
  const c = currency.trim().toUpperCase() || 'LKR';
  return `${c} ${num.toFixed(2)}`;
}
