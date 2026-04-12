'use client';

import { usePathname, useRouter } from 'next/navigation';
import api, { getAdminToken, clearAdminToken } from '@/lib/api';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useHasMounted } from '@/hooks/useHasMounted';
import { Navbar } from './Navbar';
import { BottomTabNav } from '@/components/mobile/BottomTabNav';

const PUBLIC_PATHS = ['/', '/favourites', '/account', '/login', '/register'];
const ADMIN_PATH_PREFIX = '/admin';

function isPublicLayout(pathname: string) {
  if (!pathname) return false;
  if (pathname.startsWith(ADMIN_PATH_PREFIX)) return false;
  return true;
}

type UserMe = { id: number; email: string; name: string | null; role: string };

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasMounted = useHasMounted();
  const [hasToken, setHasToken] = useState(false);
  const [user, setUser] = useState<UserMe | null>(null);

  useEffect(() => {
    setHasToken(!!getAdminToken());
  }, [pathname]);

  useEffect(() => {
    if (!getAdminToken()) {
      setUser(null);
      return;
    }
    api
      .get<UserMe>('/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => {
        setUser(null);
      });
  }, [hasToken]);

  const showAppShell = isPublicLayout(pathname ?? '');
  /** Defer URL `q` until after mount so SSR + first client paint match (fixes hydration with `/?q=…`). */
  const searchValue = hasMounted ? (searchParams?.get('q') ?? '') : '';

  /** Avoid `router.push` on every keystroke (lags suggestions). Sync URL after idle typing. */
  const searchUrlDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushHomeSearchQuery = useCallback(
    (raw: string) => {
      if (pathname !== '/') return;
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      const q = raw.trim();
      if (q) params.set('q', q);
      else params.delete('q');
      const query = params.toString();
      router.push(query ? `/?${query}` : '/');
    },
    [pathname, router, searchParams],
  );

  const flushSearchUrlDebounce = useCallback(() => {
    if (searchUrlDebounceRef.current) {
      clearTimeout(searchUrlDebounceRef.current);
      searchUrlDebounceRef.current = null;
    }
  }, []);

  useEffect(() => () => flushSearchUrlDebounce(), [flushSearchUrlDebounce]);

  const handleSearchSubmit = (value: string) => {
    flushSearchUrlDebounce();
    if (pathname === '/') {
      pushHomeSearchQuery(value ?? searchValue);
      return;
    }
    const q = (value ?? searchValue).trim();
    const params = new URLSearchParams('');
    if (q) params.set('q', q);
    else params.delete('q');
    const query = params.toString();
    router.push(query ? `/?${query}` : '/');
  };

  const handleSearchChange = (value: string) => {
    if (pathname !== '/') return;
    flushSearchUrlDebounce();
    searchUrlDebounceRef.current = setTimeout(() => {
      searchUrlDebounceRef.current = null;
      pushHomeSearchQuery(value);
    }, 280);
  };

  const handleLogout = () => {
    clearAdminToken();
    setHasToken(false);
    router.push('/');
    router.refresh();
  };

  if (!showAppShell) {
    return <>{children}</>;
  }

  return (
    <>
      <Navbar
        hasToken={hasToken}
        isAdmin={user?.role === 'admin'}
        onLogout={handleLogout}
        searchValue={searchValue}
        onSearchChange={handleSearchChange}
        onSearchSubmit={handleSearchSubmit}
      />
      <div className="pb-28 md:pb-0">
        {children}
      </div>
      <BottomTabNav />
    </>
  );
}
