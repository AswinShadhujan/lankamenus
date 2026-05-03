'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export function useDishFavourites(hasToken: boolean) {
  const router = useRouter();
  const [ids, setIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [loadingDishId, setLoadingDishId] = useState<number | null>(null);

  useEffect(() => {
    if (!hasToken) {
      setIds(new Set());
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    api
      .get<{ ids: number[] }>('/users/me/favourites/dishes/ids')
      .then((res) => {
        if (cancelled) return;
        const list = res.data.ids ?? [];
        setIds(new Set(list));
      })
      .catch(() => {
        if (!cancelled) setIds(new Set());
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hasToken]);

  const isFavourited = useCallback((id: number) => ids.has(id), [ids]);

  const toggle = useCallback(
    async (id: number) => {
      if (!hasToken) {
        router.push('/login');
        return;
      }
      if (loadingDishId != null) return;

      let wasFav = false;
      setIds((prev) => {
        wasFav = prev.has(id);
        const next = new Set(prev);
        if (wasFav) next.delete(id);
        else next.add(id);
        return next;
      });

      setLoadingDishId(id);
      try {
        if (wasFav) {
          await api.delete(`/users/me/favourites/dishes/${id}`);
        } else {
          await api.post(`/users/me/favourites/dishes/${id}`);
        }
      } catch {
        setIds((prev) => {
          const next = new Set(prev);
          if (wasFav) next.add(id);
          else next.delete(id);
          return next;
        });
      } finally {
        setLoadingDishId(null);
      }
    },
    [hasToken, loadingDishId, router],
  );

  return { isFavourited, toggle, isLoading, loadingDishId };
}
