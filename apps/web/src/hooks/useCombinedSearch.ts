'use client';

import { useEffect, useState, useRef } from 'react';
import api from '@/lib/api';
import type { CombinedSearchResponse } from '@/types/search';

/** Short debounce: feels responsive while still batching rapid keystrokes. */
const DEBOUNCE_MS = 120;

function isAbortError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'code' in err) {
    return (err as { code?: string }).code === 'ERR_CANCELED';
  }
  return false;
}

export function useCombinedSearch(searchQuery: string) {
  const [data, setData] = useState<CombinedSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [debouncing, setDebouncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const t = searchQuery.trim();
    if (t.length === 0) {
      abortRef.current?.abort();
      abortRef.current = null;
      setData(null);
      setLoading(false);
      setDebouncing(false);
      setError(null);
      return;
    }

    setDebouncing(true);
    const timer = window.setTimeout(() => {
      setDebouncing(false);
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      setError(null);

      api
        .get<CombinedSearchResponse>('/search', {
          params: { q: t },
          signal: ctrl.signal,
        })
        .then((res) => {
          if (ctrl.signal.aborted) return;
          setData(res.data);
        })
        .catch((err: unknown) => {
          if (isAbortError(err)) return;
          if (ctrl.signal.aborted) return;
          setData(null);
          setError('Search failed');
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  return { data, loading, debouncing, error };
}
