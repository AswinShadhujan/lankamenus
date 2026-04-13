import { useEffect, useState } from 'react';
import api from '@/lib/api';
import type { HeroBannerSlide } from '@/components/home/HeroBanner';
import { resolveBannerHref, type BannerCtaType } from '@/lib/banner-cta';

type ApiBanner = {
  id: number;
  title: string;
  subtitle: string | null;
  cta_label: string | null;
  cta_type: BannerCtaType | null;
  cta_url: string | null;
  restaurant_id: number | null;
  cuisine_key: string | null;
  overlay_color: string | null;
  media_asset: {
    id: number;
    secure_url: string;
  } | null;
};

function apiBannerToSlide(b: ApiBanner): HeroBannerSlide {
  return {
    id: String(b.id),
    headline: b.title,
    description: b.subtitle ?? undefined,
    imageUrl: b.media_asset?.secure_url ?? undefined,
    cta: b.cta_label ?? undefined,
    href: resolveBannerHref(b),
    overlayFrom: b.overlay_color ?? undefined,
  };
}

/** Fetches active homepage banners; returns null while loading, empty array on error/none. */
export function useBanners(): HeroBannerSlide[] | null {
  const [slides, setSlides] = useState<HeroBannerSlide[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<ApiBanner[]>('/banners/active')
      .then((res) => {
        if (cancelled) return;
        const data = res.data ?? [];
        setSlides(data.map(apiBannerToSlide));
      })
      .catch(() => {
        if (!cancelled) setSlides([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return slides;
}
