'use client';

import Link from 'next/link';
import {
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Menu, MenuItem, MenuSection } from '@/types/menu';
import { Skeleton } from '@/components/ui/Skeleton';
import { MenuItemCardThumbnail } from '@/components/restaurant/MenuItemCardThumbnail';
import { formatIngredientsBulletLine } from '@/lib/menu-ingredients';

function sectionDomId(sectionId: number) {
  return `menu-section-${sectionId}`;
}

function formatPrice(
  price: MenuItem['price'],
  currency?: string | null,
): string | null {
  if (price == null) return null;
  const num = typeof price === 'string' ? parseFloat(price) : price;
  if (Number.isNaN(num)) return null;
  const c = (currency?.trim() || 'LKR').toUpperCase();
  return `${c} ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const menuSearchInputClass =
  'rounded-full border-[1.5px] border-[var(--border)] bg-[var(--surface)] outline-none transition-[border-color,box-shadow] focus:border-[var(--accent-primary)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent-primary)_15%,transparent)]';

function MenuSearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative mb-6">
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search this menu…"
        aria-label="Search this menu"
        className={`w-full px-4 pr-10 text-[0.875rem] ${menuSearchInputClass}`}
        style={{
          height: 40,
          color: 'var(--text-primary)',
        }}
      />
      {value.length > 0 ? (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-lg leading-none transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-primary)' }}
          aria-label="Clear search"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

function sortMenuData(menu: Menu): MenuSection[] {
  return [...(menu.menu_sections ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((s) => ({
      ...s,
      menu_items: [...(s.menu_items ?? [])].sort(
        (a, b) => a.sort_order - b.sort_order,
      ),
    }));
}

const MenuDishCard = memo(function MenuDishCard({
  item,
  href,
}: {
  item: MenuItem;
  href: string;
}) {
  const ingredientsLine = formatIngredientsBulletLine(item.ingredients);
  const priceStr = formatPrice(item.price, item.currency);

  return (
    <li>
      <Link
        href={href}
        className="flex cursor-pointer gap-3 rounded-xl p-3 transition-colors hover:bg-[var(--surface)] active:bg-[var(--surface)] sm:gap-4 sm:p-3.5"
        style={{ color: 'inherit' }}
      >
        <MenuItemCardThumbnail
          url={
            item.media_asset?.secure_url?.trim() || item.image_url?.trim() || ''
          }
          alt={item.name}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span
                  className="text-base font-bold leading-snug sm:text-lg"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {item.name}
                </span>
                {item.is_popular ? (
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide sm:text-xs"
                    style={{
                      backgroundColor:
                        'color-mix(in srgb, var(--accent-primary) 14%, transparent)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    🔥 Popular
                  </span>
                ) : null}
                {item.is_recommended ? (
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide sm:text-xs"
                    style={{
                      backgroundColor:
                        'color-mix(in srgb, #8b5cf6 16%, transparent)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    ⭐ Recommended
                  </span>
                ) : null}
                {item.veg ? (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium sm:text-xs"
                    style={{
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    Veg
                  </span>
                ) : null}
              </div>
              {ingredientsLine ? (
                <p
                  className="mt-1 text-xs leading-relaxed sm:text-sm"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {ingredientsLine}
                </p>
              ) : null}
              {item.description != null && item.description !== '' ? (
                <p
                  className="mt-1 line-clamp-2 text-xs leading-relaxed sm:text-sm"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {item.description}
                </p>
              ) : null}
            </div>
            {priceStr != null ? (
              <span
                className="shrink-0 text-right text-base font-bold tabular-nums sm:text-lg"
                style={{ color: 'var(--text-primary)' }}
              >
                {priceStr}
              </span>
            ) : null}
          </div>
        </div>
      </Link>
    </li>
  );
});

type RestaurantMenuExperienceProps = {
  restaurantIdParam: string;
  /** One menu per restaurant in current product design. */
  menu: Menu | null;
  /** True after load when this restaurant has no menus. */
  noMenuAvailable: boolean;
};

export function RestaurantMenuExperience({
  restaurantIdParam,
  menu,
  noMenuAvailable,
}: RestaurantMenuExperienceProps) {
  const [activeSectionId, setActiveSectionId] = useState<number | null>(null);
  const [menuQuery, setMenuQuery] = useState('');
  const scrollLockRef = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sectionRefs = useRef<Map<number, HTMLElement>>(new Map());

  const sections = useMemo(
    () => (menu ? sortMenuData(menu) : []),
    [menu],
  );

  const filteredSections = useMemo(() => {
    const q = menuQuery.trim().toLowerCase();
    if (!q) return sections;
    return sections
      .map((s) => ({
        ...s,
        menu_items: (s.menu_items ?? []).filter((item) =>
          item.name.toLowerCase().includes(q),
        ),
      }))
      .filter((s) => (s.menu_items?.length ?? 0) > 0);
  }, [sections, menuQuery]);

  const menuQueryTrimmed = menuQuery.trim();
  const hasMenuQuery = menuQueryTrimmed.length > 0;
  const noMenuSearchResults = hasMenuQuery && filteredSections.length === 0;

  useLayoutEffect(() => {
    if (!filteredSections.length) {
      setActiveSectionId(null);
      return;
    }
    setActiveSectionId((prev) => {
      if (prev != null && filteredSections.some((s) => s.id === prev)) return prev;
      return filteredSections[0].id;
    });
  }, [filteredSections]);

  const registerSection = useCallback((id: number, el: HTMLElement | null) => {
    const obs = observerRef.current;
    if (el) {
      const prev = sectionRefs.current.get(id);
      if (prev && prev !== el && obs) obs.unobserve(prev);
      sectionRefs.current.set(id, el);
      obs?.observe(el);
    } else {
      const prev = sectionRefs.current.get(id);
      if (prev && obs) obs.unobserve(prev);
      sectionRefs.current.delete(id);
    }
  }, []);

  useLayoutEffect(() => {
    observerRef.current?.disconnect();
    observerRef.current = null;

    if (!filteredSections.length) {
      setActiveSectionId(null);
      return;
    }

    const pickBest = (entries: IntersectionObserverEntry[]) => {
      if (scrollLockRef.current) return;
      let best: IntersectionObserverEntry | null = null;
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        if (
          !best ||
          e.intersectionRatio > best.intersectionRatio ||
          (e.intersectionRatio === best.intersectionRatio &&
            e.boundingClientRect.top < best.boundingClientRect.top)
        ) {
          best = e;
        }
      }
      if (best?.target) {
        const sid = Number((best.target as HTMLElement).dataset.sectionId);
        if (!Number.isNaN(sid)) setActiveSectionId(sid);
      }
    };

    const obs = new IntersectionObserver(pickBest, {
      root: null,
      rootMargin: '-12% 0px -55% 0px',
      threshold: [0, 0.05, 0.1, 0.2, 0.35, 0.5, 0.75, 1],
    });
    observerRef.current = obs;

    for (const s of filteredSections) {
      const el = sectionRefs.current.get(s.id);
      if (el) obs.observe(el);
    }

    return () => {
      obs.disconnect();
      observerRef.current = null;
    };
  }, [filteredSections]);

  const scrollToSection = useCallback((sectionId: number) => {
    const el = document.getElementById(sectionDomId(sectionId));
    if (!el) return;
    scrollLockRef.current = true;
    setActiveSectionId(sectionId);
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => {
      scrollLockRef.current = false;
    }, 900);
  }, []);

  const categoryButtonClass = (active: boolean) =>
    [
      'shrink-0 rounded-full px-4 py-2.5 text-sm font-medium transition-colors',
      'min-h-[44px] snap-center',
      active ? 'shadow-sm' : 'opacity-90 hover:opacity-100',
    ].join(' ');

  if (noMenuAvailable) {
    return (
      <p className="text-small" style={{ color: 'var(--text-primary)' }}>
        No menu available yet.
      </p>
    );
  }

  if (!menu) {
    return null;
  }

  return (
    <div>
      <MenuSearchInput value={menuQuery} onChange={setMenuQuery} />

      {noMenuSearchResults ? (
        <p className="text-small" style={{ color: 'var(--text-primary)' }}>
          No items found for &apos;{menuQueryTrimmed}&apos;
        </p>
      ) : null}

      <div className="lg:grid lg:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] lg:items-start lg:gap-10 xl:grid-cols-[13rem_minmax(0,1fr)]">
      <aside className="mb-0 hidden lg:block">
          <nav
            className="sticky top-20 space-y-1 border-l-2 pl-4"
            style={{ borderColor: 'var(--border)' }}
            aria-label="Menu categories"
          >
            {filteredSections.map((s) => {
              const active = activeSectionId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => scrollToSection(s.id)}
                  className={`block w-full rounded-r-md py-2.5 pl-2 text-left text-sm font-semibold transition-colors ${
                    active ? '' : 'hover:opacity-90'
                  }`}
                  style={{
                    color: active
                      ? 'var(--accent-primary)'
                      : 'var(--text-primary)',
                    backgroundColor: active
                      ? 'color-mix(in srgb, var(--accent-primary) 12%, transparent)'
                      : 'transparent',
                  }}
                >
                  {s.name}
                </button>
              );
            })}
          </nav>
      </aside>

      <div className="min-w-0">
        {filteredSections.length > 0 && (
            <div
              className="sticky top-0 z-30 -mx-4 mb-6 border-b px-4 py-3 backdrop-blur-md lg:hidden sm:-mx-6 sm:px-6"
              style={{
                borderColor: 'var(--border)',
                backgroundColor:
                  'color-mix(in srgb, var(--background) 88%, transparent)',
              }}
            >
              <div
                className="-mx-1 flex gap-2 overflow-x-auto pb-1 pt-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                {filteredSections.map((s) => {
                  const active = activeSectionId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => scrollToSection(s.id)}
                      className={categoryButtonClass(active)}
                      style={{
                        color: active
                          ? 'var(--background)'
                          : 'var(--text-primary)',
                        backgroundColor: active
                          ? 'var(--accent-primary)'
                          : 'var(--surface)',
                        border: `1px solid ${active ? 'transparent' : 'var(--border)'}`,
                      }}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>
        )}

        {sections.length === 0 ? (
          <p className="text-small" style={{ color: 'var(--text-primary)' }}>
            No sections in this menu.
          </p>
        ) : noMenuSearchResults ? null : (
          <div className="space-y-10 sm:space-y-12">
            {filteredSections.map((section) => (
              <section
                key={section.id}
                id={sectionDomId(section.id)}
                ref={(el) => registerSection(section.id, el)}
                data-section-id={section.id}
                className="scroll-mt-[5.5rem] lg:scroll-mt-24"
              >
                <div
                  className="mb-4 border-b-2 pb-3 sm:mb-5"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <h4
                    className="text-xs font-bold uppercase tracking-[0.12em] sm:text-sm"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {section.name}
                  </h4>
                </div>
                <ul className="flex flex-col gap-1 sm:gap-2">
                  {section.menu_items?.map((item) => (
                    <MenuDishCard
                      key={item.id}
                      item={item}
                      href={`/restaurants/${restaurantIdParam}/menus/${menu.id}/items/${item.id}`}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

function MenuMenuSkeleton() {
  return (
    <div className="space-y-10 animate-pulse" aria-hidden>
      <div className="flex gap-2 overflow-hidden lg:hidden">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-11 w-24 shrink-0 rounded-full" />
        ))}
      </div>
      {[1, 2].map((block) => (
        <div key={block}>
          <Skeleton className="mb-4 h-4 w-40" />
          <div className="space-y-3 border-t border-[var(--border)] pt-4">
            {[1, 2, 3].map((row) => (
              <div key={row} className="flex gap-3">
                <Skeleton className="h-20 w-20 shrink-0 rounded-xl sm:h-24 sm:w-24" />
                <div className="flex-1 space-y-2 pt-1">
                  <Skeleton className="h-4 w-3/5 max-w-xs" />
                  <Skeleton className="h-3 w-full max-w-sm" />
                </div>
                <Skeleton className="h-4 w-16 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export { MenuMenuSkeleton };
