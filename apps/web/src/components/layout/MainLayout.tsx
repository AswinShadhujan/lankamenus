'use client';

import { usePathname, useRouter } from 'next/navigation';
import api, { getAdminToken, clearAdminToken } from '@/lib/api';
import { useEffect, useState } from 'react';
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

  const handleSearchSubmit = (value: string) => {
    const q = (value ?? searchValue).trim();
    const params = new URLSearchParams(
      pathname === '/' ? (searchParams?.toString() ?? '') : '',
    );
    if (q) params.set('q', q);
    else params.delete('q');
    const query = params.toString();
    router.push(query ? `/?${query}` : '/');
  };

  const handleSearchChange = (value: string) => {
    if (pathname !== '/') return;
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (value.trim()) params.set('q', value);
    else params.delete('q');
    const query = params.toString();
    router.push(query ? `/?${query}` : '/');
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
