'use client';

import type { CSSProperties, ReactNode } from 'react';
import type { Restaurant } from '@/types/restaurant';
type RestaurantDetailDesktopInfoProps = {
  restaurant: Restaurant;
  googleMapsUrl: string;
};

const LABEL_STYLE: CSSProperties = {
  fontSize: '12px',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  fontWeight: 500,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--text-primary)',
};

const VALUE_STYLE: CSSProperties = {
  fontSize: '14px',
  color: 'var(--text-primary)',
};

const ROW_BORDER: CSSProperties = {
  borderBottom: '0.5px solid #EBEBEB',
};

const PRICE_NOTES: Record<number, string> = {
  1: 'Budget friendly',
  2: 'Moderate',
  3: 'Upscale',
  4: 'Fine dining',
};

function DefRow({
  label,
  children,
  className = '',
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`grid min-h-[52px] grid-cols-[minmax(7rem,10rem)_1fr] items-center gap-x-8 lg:grid-cols-[11rem_1fr] lg:gap-x-12 ${className}`}
      style={ROW_BORDER}
    >
      <dt className="m-0 leading-none" style={LABEL_STYLE}>
        {label}
      </dt>
      <dd className="m-0 min-w-0 leading-snug" style={VALUE_STYLE}>
        {children}
      </dd>
    </div>
  );
}

function DirectionsButton({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title="Open in Google Maps"
      className="inline-flex shrink-0 items-center rounded-[8px] border border-[#1A1A1A] bg-transparent px-2.5 py-1 text-[11px] font-medium text-[#1A1A1A] no-underline transition-colors duration-150 hover:bg-[#1A1A1A] hover:text-white"
    >
      ↗ Directions
    </a>
  );
}

function DietIndicator({ label, positive }: { label: string; positive: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-sm"
      style={{ color: 'var(--text-primary)' }}
      aria-label={positive ? `${label} available` : `${label} not available`}
    >
      {label} {positive ? '✅' : '❌'}
    </span>
  );
}

function MapPinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function priceRangeNote(level: number): string {
  const rounded = Math.min(4, Math.max(1, Math.round(level)));
  return PRICE_NOTES[rounded] ?? 'Budget friendly';
}

export function RestaurantDetailDesktopInfo({
  restaurant,
  googleMapsUrl,
}: RestaurantDetailDesktopInfoProps) {
  const location = [restaurant.city, restaurant.district].filter(Boolean).join(', ');
  const addressLine = [restaurant.address_line1?.trim(), location].filter(Boolean).join(', ');
  const extraCosts = restaurant.restaurant_extra_costs ?? [];
  const hasPrice = restaurant.price_level != null;
  return (
    <section className="mt-6 hidden w-full md:block" aria-label="Restaurant details">
      <p className="m-0 leading-none" style={LABEL_STYLE}>
        Restaurant
      </p>
      <div className="mt-2 flex items-start justify-between gap-3">
        <h1
          className="min-w-0 flex-1 leading-tight"
          style={{
            fontSize: '22px',
            fontWeight: 500,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-display, var(--font-sans))',
            wordBreak: 'break-word',
          }}
        >
          {restaurant.name_default}
        </h1>
        <DirectionsButton href={googleMapsUrl} />
      </div>

      <dl className="m-0 mt-6 w-full">
        {addressLine ? (
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in Google Maps"
            className="grid min-h-[52px] cursor-pointer grid-cols-[minmax(7rem,10rem)_1fr] items-center gap-x-8 no-underline transition-colors duration-150 hover:bg-[#F7F7F5] lg:grid-cols-[11rem_1fr] lg:gap-x-12"
            style={ROW_BORDER}
          >
            <span className="leading-none" style={LABEL_STYLE}>
              Address
            </span>
            <span className="flex min-w-0 items-center gap-2 leading-snug">
              <span style={{ color: 'var(--text-primary)' }}>
                <MapPinIcon />
              </span>
              <span style={{ color: 'var(--text-primary)', fontSize: '14px' }}>{addressLine}</span>
            </span>
          </a>
        ) : null}

        <DefRow label="Dietary">
          <div className="flex flex-wrap items-center gap-2">
            <DietIndicator label="Veg" positive={restaurant.veg_friendly} />
            <DietIndicator label="Halal" positive={restaurant.halal_certified} />
          </div>
        </DefRow>

        {hasPrice ? (
          <DefRow label="Price range">
            <span className="inline-flex flex-wrap items-baseline gap-2">
              <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                {'$'.repeat(Math.min(4, Math.max(1, Math.round(restaurant.price_level!))))}
              </span>
              <span style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--text-primary)' }}>
                {priceRangeNote(restaurant.price_level!)}
              </span>
            </span>
          </DefRow>
        ) : null}

        {extraCosts.length > 0 ? (
          <DefRow label="Additional charges">
            <div className="space-y-0.5">
              {extraCosts.map((cost) => (
                <p
                  key={cost.id}
                  className="m-0"
                  style={{ fontSize: '12px', color: 'var(--text-primary)' }}
                >
                  · {Number(cost.rate)}% {cost.label.toLowerCase()} applies
                </p>
              ))}
            </div>
          </DefRow>
        ) : null}
      </dl>
    </section>
  );
}
