'use client';

import { useEffect, RefObject } from 'react';

/**
 * Fires `onIntersect` when the sentinel element enters the viewport (near bottom).
 * Use for infinite scroll; gate `onIntersect` with loading/hasMore guards inside the callback.
 */
export function useIntersectionLoadMore(
  sentinelRef: RefObject<HTMLElement | null>,
  onIntersect: () => void,
  enabled: boolean,
) {
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !enabled) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) onIntersect();
      },
      { root: null, rootMargin: '400px 0px', threshold: 0 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [sentinelRef, onIntersect, enabled]);
}
