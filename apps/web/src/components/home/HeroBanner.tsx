'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Turns pasted JS-style `\u2192` into real characters (common in admin/CMS text). */
function decodeBannerText(text: string): string {
  return text.replace(/\\u([0-9a-fA-F]{4})/gi, (_, hex: string) =>
    String.fromCodePoint(parseInt(hex, 16)),
  );
}

export type HeroBannerSlide = {
  id: string;
  headline: string;
  description?: string;
  imageUrl?: string;
  cta?: string;
  href?: string;
  overlayFrom?: string;
};

const AUTO_INTERVAL_MS = 5000;

type Props = {
  slides: HeroBannerSlide[];
};

export function HeroBanner({ slides }: Props) {
  const [active, setActive] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const count = slides.length;

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (count <= 1) return;
    timerRef.current = setInterval(() => {
      setActive((prev) => (prev + 1) % count);
    }, AUTO_INTERVAL_MS);
  }, [count]);

  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [resetTimer]);

  const goTo = useCallback(
    (idx: number) => {
      setActive(idx);
      resetTimer();
    },
    [resetTimer],
  );

  const prev = useCallback(
    () => goTo((active - 1 + count) % count),
    [active, count, goTo],
  );
  const next = useCallback(
    () => goTo((active + 1) % count),
    [active, count, goTo],
  );

  if (count === 0) return null;

  const slide = slides[active];
  const headline = decodeBannerText(slide.headline);
  const description = slide.description ? decodeBannerText(slide.description) : undefined;
  const cta = slide.cta ? decodeBannerText(slide.cta) : undefined;

  return (
    <section
      className="relative isolate overflow-hidden rounded-2xl"
      aria-roledescription="carousel"
      aria-label="Promotional banners"
    >
      {/* Background layer */}
      <div className="absolute inset-0 -z-10 transition-opacity duration-700">
        {slide.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={slide.id}
            src={slide.imageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            key={slide.id}
            className="h-full w-full"
            style={{
              background: `linear-gradient(135deg, ${slide.overlayFrom ?? 'var(--accent-primary)'} 0%, #0e0e0e 100%)`,
            }}
          />
        )}
      </div>

      {/* Overlay for text readability */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />

      {/* Content */}
      <div className="relative flex min-h-[180px] flex-col justify-center px-6 py-8 sm:min-h-[220px] sm:px-10 sm:py-10 lg:min-h-[260px]">
        <h2 className="max-w-lg text-xl font-bold leading-snug text-white sm:text-2xl lg:text-3xl">
          {headline}
        </h2>
        {description && (
          <p className="mt-2 max-w-md text-sm leading-relaxed text-white/80 sm:text-base">
            {description}
          </p>
        )}
        {cta && slide.href && (
          <a
            href={slide.href}
            className="mt-4 inline-flex w-fit items-center rounded-full bg-white/95 px-5 py-2 text-sm font-semibold text-neutral-900 shadow-md transition-transform duration-200 hover:scale-[1.03] hover:shadow-lg active:scale-[0.98]"
          >
            {cta}
            <span className="ml-1.5" aria-hidden>
              →
            </span>
          </a>
        )}
      </div>

      {/* Arrows + dots only when 2+ slides (single backend banner stays clean). */}
      {count > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/60 sm:left-3 sm:p-2"
            aria-label="Previous slide"
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
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/60 sm:right-3 sm:p-2"
            aria-label="Next slide"
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
            >
              <polyline points="9 6 15 12 9 18" />
            </svg>
          </button>
        </>
      )}

      {/* Dots */}
      {count > 1 && (
        <div
          className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5"
          role="tablist"
        >
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={`Slide ${i + 1}`}
              onClick={() => goTo(i)}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === active ? '1.25rem' : '0.375rem',
                backgroundColor:
                  i === active ? '#ffffff' : 'rgba(255,255,255,0.45)',
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
