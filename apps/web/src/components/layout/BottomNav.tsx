'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type BottomNavProps = { isAdmin?: boolean };

export function BottomNav({ isAdmin = false }: BottomNavProps) {
  const pathname = usePathname();

  const base =
    'flex flex-col items-center justify-center gap-0.5 py-2 text-small transition-colors';
  const active = 'text-[var(--accent-primary)]';
  const inactive = 'text-[var(--text-secondary)]';

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t md:hidden"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}
    >
      <div className="mx-auto flex max-w-lg items-center justify-around">
        <Link
          href="/"
          className={`${base} min-w-[64px] ${pathname === '/' ? active : inactive}`}
        >
          <span className="text-lg">🏠</span>
          <span>Home</span>
        </Link>
        <Link
          href="/#search"
          className={`${base} min-w-[64px] ${pathname === '/' ? inactive : inactive}`}
        >
          <span className="text-lg">🔍</span>
          <span>Search</span>
        </Link>
        <Link
          href="/favourites"
          className={`${base} min-w-[64px] ${pathname === '/favourites' ? active : inactive}`}
        >
          <span className="text-lg">❤️</span>
          <span>Favourites</span>
        </Link>
        {isAdmin && (
          <Link
            href="/admin/restaurants"
            className={`${base} min-w-[64px] ${pathname?.startsWith('/admin') ? active : inactive}`}
          >
            <span className="text-lg">⚙️</span>
            <span>Admin</span>
          </Link>
        )}
        <Link
          href="/account"
          className={`${base} min-w-[64px] ${pathname === '/account' ? active : inactive}`}
        >
          <span className="text-lg">👤</span>
          <span>Profile</span>
        </Link>
      </div>
    </nav>
  );
}
