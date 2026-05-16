/** 10px veg / non-veg dot; hidden when `veg` is null or undefined. */
export function VegIndicatorDot({ veg }: { veg: boolean | null | undefined }) {
  if (veg == null) return null;

  const isVeg = veg === true;
  const label = isVeg ? 'Vegetarian' : 'Non-vegetarian';

  return (
    <span
      className="inline-block shrink-0 rounded-full align-middle"
      style={{
        width: 10,
        height: 10,
        backgroundColor: isVeg ? '#16a34a' : '#dc2626',
      }}
      title={label}
      aria-label={label}
      role="img"
    />
  );
}
