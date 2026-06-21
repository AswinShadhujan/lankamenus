'use client';

import { memo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import type { CombinedSearchDish, CombinedSearchResponse, CombinedSearchRestaurant } from '@/types/search';
import { MatchHighlight } from '@/components/search/MatchHighlight';
import { RestaurantPhotoImage } from '@/components/ui/RestaurantPhotoImage';
import { resolvePublicMediaUrl } from '@/lib/api';
import { normalizeRestaurantCategories } from '@/lib/foodCategories';

const SKELETON_ROW_COUNT = 4;

function formatPrice(price: number | null): string | null {
  if (price == null || Number.isNaN(price)) return null;
  return `LKR ${price.toFixed(2)}`;
}

function SkeletonRows({ count = SKELETON_ROW_COUNT }: { count?: number }) {
  return (
    <ul className="px-1 py-1" aria-busy="true" aria-label="Loading search results">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="flex min-h-[52px] items-center gap-3 px-2 py-2.5 md:min-h-[48px]">
          <div className="h-12 w-12 shrink-0 animate-pulse rounded-xl bg-[var(--border)]" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 max-w-[70%] animate-pulse rounded-md bg-[var(--border)]" />
            <div className="h-3 max-w-[45%] animate-pulse rounded-md bg-[var(--border)]" />
          </div>
          <div className="h-4 w-16 shrink-0 animate-pulse rounded-md bg-[var(--border)]" />
        </li>
      ))}
    </ul>
  );
}

function SectionDivider() {
  return (
    <div
      className="mx-3 my-1 h-px shrink-0"
      style={{ backgroundColor: 'var(--border)' }}
      role="separator"
    />
  );
}

function SectionHeader({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div
      className="px-3 pb-2 pt-3"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
        {emoji} {label}
      </p>
    </div>
  );
}

/** Muted empty line under a section header (consistent padding). */
function SectionEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="px-3 py-3 text-small leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
      {children}
    </p>
  );
}

function DishThumb({ src, alt }: { src: string | null; alt: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg"
        style={{ backgroundColor: 'var(--surface)', color: 'var(--text-secondary)' }}
        aria-hidden
      >
        🍽
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- external menu URLs
    <img
      src={src}
      alt={alt}
      width={48}
      height={48}
      className="h-12 w-12 shrink-0 rounded-xl object-cover"
      onError={() => setBroken(true)}
    />
  );
}

function DishRow({
  d,
  q,
  onNavigate,
}: {
  d: CombinedSearchDish;
  q: string;
  onNavigate?: () => void;
}) {
  const priceStr = formatPrice(d.price);
  return (
    <li>
      <Link
        href={`/restaurants/${d.restaurant_id}/menus/${d.menu_id}/items/${d.id}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onNavigate}
        className="flex min-h-[52px] touch-manipulation items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-150 hover:bg-[var(--surface)] active:bg-[var(--surface)] md:min-h-[48px]"
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        <DishThumb src={resolvePublicMediaUrl(d.image)} alt="" />
        <div className="min-w-0 flex-1">
          <p className="text-body font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
            <MatchHighlight text={d.name} query={q} />
          </p>
          <p className="text-small mt-0.5 line-clamp-1" style={{ color: 'var(--text-secondary)' }}>
            {d.restaurant_name}
          </p>
        </div>
        {priceStr != null ? (
          <span className="shrink-0 text-small font-semibold tabular-nums" style={{ color: 'var(--accent-secondary)' }}>
            {priceStr}
          </span>
        ) : (
          <span className="w-16 shrink-0" aria-hidden />
        )}
      </Link>
    </li>
  );
}

function RestaurantRow({
  r,
  q,
  onNavigate,
}: {
  r: CombinedSearchRestaurant;
  q: string;
  onNavigate?: () => void;
}) {
  const tags = normalizeRestaurantCategories(r.cuisine_tags ?? []).slice(0, 3);
  const location = [r.city, r.district].filter(Boolean).join(' · ');

  return (
    <li>
      <Link
        href={`/restaurants/${r.id}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onNavigate}
        className="flex min-h-[52px] touch-manipulation items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-150 hover:bg-[var(--surface)] active:bg-[var(--surface)] md:min-h-[48px]"
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        <RestaurantPhotoImage
          restaurant={{
            id: r.id,
            photo_reference: r.photo_reference ?? null,
            media_asset: r.media_asset ?? null,
          }}
          alt=""
          className="h-12 w-12 shrink-0 rounded-xl object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="text-body font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
            <MatchHighlight text={r.name_default} query={q} />
          </p>
          {location ? (
            <p className="text-small mt-0.5 line-clamp-1" style={{ color: 'var(--text-secondary)' }}>
              {location}
            </p>
          ) : null}
          {tags.length > 0 ? (
            <div className="mt-1.5 flex max-w-full flex-wrap gap-1">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-block max-w-full truncate rounded-full border px-2 py-0.5 text-[10px] font-medium leading-tight sm:text-xs"
                  style={{
                    borderColor: 'var(--border)',
                    color: 'var(--text-secondary)',
                    backgroundColor: 'var(--surface)',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </Link>
    </li>
  );
}

export type SearchDropdownProps = {
  query: string;
  data: CombinedSearchResponse | null;
  loading: boolean;
  debouncing: boolean;
  error: string | null;
  scope?: 'dishes' | 'restaurants';
  onNavigate?: () => void;
};

function SearchDropdownInner({
  query,
  data,
  loading,
  debouncing,
  error,
  scope = 'restaurants',
  onNavigate,
}: SearchDropdownProps) {
  const q = query.trim();
  const showSkeleton = debouncing || loading;
  const loaded = !showSkeleton && !error && data != null;

  const dishes = scope === 'dishes' ? (data?.dishes ?? []) : [];
  const restaurants = scope === 'restaurants' ? (data?.restaurants ?? []) : [];
  const bothEmpty = loaded && dishes.length === 0 && restaurants.length === 0;
  const showSections = loaded && !bothEmpty;

  return (
    <div
      className="lm-fade-in absolute left-0 right-0 top-full z-[60] mt-1.5 max-h-[min(72dvh,26rem)] w-full min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain rounded-2xl border py-1 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.28)] dark:shadow-[0_12px_48px_-8px_rgba(0,0,0,0.65)]"
      style={{
        backgroundColor: 'var(--background)',
        borderColor: 'var(--border)',
      }}
      role="listbox"
      aria-label="Search suggestions"
      onMouseDown={(e) => e.preventDefault()}
    >
      {showSkeleton && <SkeletonRows />}

      {!showSkeleton && error ? (
        <p className="px-4 py-5 text-center text-small text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      {bothEmpty ? (
        <p className="px-4 py-8 text-center text-small leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          No results found
        </p>
      ) : null}

      {showSections ? (
        <>
          {scope === 'dishes' ? (
            <>
              <SectionHeader emoji="🍽" label="Dishes" />
              {dishes.length > 0 ? (
                <ul className="px-1 pb-1 pt-0.5">
                  {dishes.map((d) => (
                    <DishRow key={`d-${d.menu_id}-${d.id}`} d={d} q={q} onNavigate={onNavigate} />
                  ))}
                </ul>
              ) : (
                <SectionEmpty>No dishes found</SectionEmpty>
              )}
            </>
          ) : (
            <>
              <SectionHeader emoji="🏪" label="Restaurants" />
              {restaurants.length > 0 ? (
                <ul className="px-1 pb-2 pt-0.5">
                  {restaurants.map((r) => (
                    <RestaurantRow key={`r-${r.id}`} r={r} q={q} onNavigate={onNavigate} />
                  ))}
                </ul>
              ) : (
                <SectionEmpty>No restaurants found</SectionEmpty>
              )}
            </>
          )}
        </>
      ) : null}
    </div>
  );
}

export const SearchDropdown = memo(SearchDropdownInner);
