'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearAdminToken, getAdminToken } from '@/lib/api';
import { useTheme } from '@/components/ThemeProvider';

export default function AdminLayout({
  children,
}: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { theme, toggleTheme, mounted: themeMounted } = useTheme();

  const isLoginPage = pathname === '/admin/login';
  const token = mounted ? getAdminToken() : null;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    if (!isLoginPage && !token) {
      router.replace('/admin/login');
    }
  }, [mounted, isLoginPage, token, router]);

  const handleLogout = () => {
    clearAdminToken();
    router.push('/admin/login');
    router.refresh();
  };

  if (!mounted) {
    return (
      <div className="admin-shell flex min-h-screen items-center justify-center">
        <p className="admin-text-muted">Loading…</p>
      </div>
    );
  }

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link
            href="/admin/restaurants"
            className="text-small font-semibold transition-opacity hover:opacity-80"
            style={{ color: 'var(--text-primary)' }}
          >
            Restaurants
          </Link>
          <Link
            href="/admin/banners"
            className="text-small font-semibold transition-opacity hover:opacity-80"
            style={{ color: 'var(--text-primary)' }}
          >
            Banners
          </Link>
          <Link href="/" className="admin-link text-small font-normal">
            View site
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="admin-btn-ghost rounded-md px-2 py-1.5 text-lg"
            aria-label={
              themeMounted
                ? theme === 'dark'
                  ? 'Switch to light mode'
                  : 'Switch to dark mode'
                : 'Toggle color theme'
            }
          >
            <span className="inline-block min-w-[1.25rem] text-center">
              {themeMounted ? (theme === 'dark' ? '☀️' : '🌙') : '🌓'}
            </span>
          </button>
          <button type="button" onClick={handleLogout} className="admin-btn-text">
            Log out
          </button>
        </div>
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}
