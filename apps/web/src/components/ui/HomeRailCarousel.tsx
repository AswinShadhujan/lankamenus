'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

export const HOME_RAIL_ITEM_ATTR = 'data-home-rail-item';

type HomeRailCarouselProps = {
  children: ReactNode;
  className?: string;
  prevLabel?: string;
  nextLabel?: string;
};

function RailArrowButton({
  direction,
  disabled,
  onClick,
  label,
}: {
  direction: 'prev' | 'next';
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`absolute top-1/2 z-[2] flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border shadow-sm transition-opacity disabled:pointer-events-none disabled:opacity-0 sm:h-9 sm:w-9 ${
        direction === 'prev' ? 'left-0 sm:-left-3' : 'right-0 sm:-right-3'
      }`}
      style={{
        borderColor: 'var(--border)',
        backgroundColor: 'var(--surface)',
        color: 'var(--text-primary)',
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {direction === 'prev' ? (
          <polyline points="15 18 9 12 15 6" />
        ) : (
          <polyline points="9 6 15 12 9 18" />
        )}
      </svg>
    </button>
  );
}

/** Homepage discovery rails — arrow navigation, hidden scrollbars. */
export function HomeRailCarousel({
  children,
  className = '',
  prevLabel = 'Previous items',
  nextLabel = 'Next items',
}: HomeRailCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) {
      setCanPrev(false);
      setCanNext(false);
      return;
    }
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanPrev(el.scrollLeft > 1);
    setCanNext(el.scrollLeft < maxScroll - 1);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener('scroll', updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      ro.disconnect();
    };
  }, [updateArrows, children]);

  const scrollByPage = (direction: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const first = el.querySelector(`[${HOME_RAIL_ITEM_ATTR}]`) as HTMLElement | null;
    const step = first ? first.offsetWidth + 12 : el.clientWidth * 0.9;
    el.scrollBy({ left: direction * step, behavior: 'smooth' });
  };

  return (
    <div className={`relative ${className}`}>
      <RailArrowButton
        direction="prev"
        disabled={!canPrev}
        label={prevLabel}
        onClick={() => scrollByPage(-1)}
      />
      <div
        ref={scrollerRef}
        className="hide-scrollbar overflow-x-auto overflow-y-hidden scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [-webkit-overflow-scrolling:touch]"
        style={{ touchAction: 'pan-y pinch-zoom' }}
      >
        <div className="flex snap-x snap-mandatory items-stretch gap-3 sm:gap-4">{children}</div>
      </div>
      <RailArrowButton
        direction="next"
        disabled={!canNext}
        label={nextLabel}
        onClick={() => scrollByPage(1)}
      />
    </div>
  );
}
