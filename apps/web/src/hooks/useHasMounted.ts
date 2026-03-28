'use client';

import { useEffect, useState } from 'react';

/**
 * True only after the first client effect. Use to defer reading browser-only /
 * hydration-sensitive values (e.g. `useSearchParams()`) so server HTML and the
 * first client render match, avoiding React hydration errors.
 */
export function useHasMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}
