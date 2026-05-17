'use client';

import type { ReactNode } from 'react';
import type { Restaurant } from '@/types/restaurant';

type RestaurantDetailMobileInfoProps = {
  restaurant: Restaurant;
};

function InfoRowIcon({ children }: { children: ReactNode }) {
  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center"
      style={{ color: '#333333' }}
      aria-hidden
    >
      {children}
    </span>
  );
}

function RowDivider() {
  return (
    <div
      className="w-full"
      style={{
        height: '0.5px',
        backgroundColor: 'color-mix(in srgb, var(--border) 80%, transparent)',
      }}
      role="separator"
    />
  );
}

function InfoRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-[44px] items-center gap-3 px-3">
      {icon}
      <div className="min-w-0 flex-1 text-sm leading-snug text-black">
        {children}
      </div>
    </div>
  );
}

function DietIndicator({ label, positive }: { label: string; positive: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-sm"
      style={{ color: '#000000' }}
      aria-label={positive ? `${label} available` : `${label} not available`}
    >
      {label} {positive ? '✅' : '❌'}
    </span>
  );
}

function PriceRangeBadge({ level }: { level: number }) {
  const count = Math.min(4, Math.max(1, Math.round(level)));
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-sm font-semibold tracking-wide"
      style={{
        backgroundColor: 'transparent',
        color: '#000000',
        border: '1px solid #E0E0E0',
      }}
      aria-label={`Price range ${count} of 4`}
    >
      {'$'.repeat(count)}
    </span>
  );
}

function MapPinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function DollarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function LeafIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 19 2c1 2 2 4.5 2 8 0 5.5-4.5 10-10 10Z" />
      <path d="M2 21c0-3 1.5-5 5-5" />
    </svg>
  );
}

export function RestaurantDetailMobileInfo({
  restaurant,
}: RestaurantDetailMobileInfoProps) {
  const location = [restaurant.city, restaurant.district].filter(Boolean).join(', ');
  const address = restaurant.address_line1?.trim() || '';
  const extraCosts = restaurant.restaurant_extra_costs ?? [];

  const hasAddressRow = Boolean(address || location);
  const hasPrice = restaurant.price_level != null;

  return (
    <section className="mb-5 md:hidden" aria-label="Restaurant details">
      <div
        className="overflow-hidden rounded-xl border"
        style={{
          borderColor: 'var(--border)',
          backgroundColor: 'var(--surface)',
        }}
      >
        {hasAddressRow ? (
          <>
            <InfoRow icon={<InfoRowIcon><MapPinIcon /></InfoRowIcon>}>
              <span className="block truncate">{address || location}</span>
              {address && location ? (
                <span className="mt-0.5 block truncate text-xs text-[#333333]">
                  {location}
                </span>
              ) : null}
            </InfoRow>
            <RowDivider />
          </>
        ) : null}

        <InfoRow icon={<InfoRowIcon><LeafIcon /></InfoRowIcon>}>
          <div className="flex flex-wrap items-center gap-2">
            <DietIndicator label="Veg" positive={restaurant.veg_friendly} />
            <DietIndicator label="Halal" positive={restaurant.halal_certified} />
          </div>
        </InfoRow>

        {hasPrice ? (
          <>
            <RowDivider />
            <InfoRow icon={<InfoRowIcon><DollarIcon /></InfoRowIcon>}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-black">
                  Price range
                </span>
                <PriceRangeBadge level={restaurant.price_level!} />
              </div>
            </InfoRow>
          </>
        ) : null}
      </div>

      {extraCosts.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {extraCosts.map((cost) => (
            <span
              key={cost.id}
              className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--border) 25%, var(--surface))',
                color: '#333333',
                border: '1px solid #E0E0E0',
              }}
            >
              {Number(cost.rate)}% {cost.label.toLowerCase()}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
