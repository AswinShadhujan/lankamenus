'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function BottomTabNav() {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const isFavourites = pathname === '/favourites';
  const isAccount = pathname === '/account';

  const tabBase =
    'relative flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 text-xs font-semibold transition-colors active:opacity-90';

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t pb-[env(safe-area-inset-bottom,0px)] md:hidden"
      style={{
        borderColor: 'var(--border)',
        backgroundColor: 'color-mix(in srgb, var(--background) 94%, transparent)',
        backdropFilter: 'blur(12px)',
      }}
      aria-label="Primary mobile navigation"
    >
      <div className="mx-auto grid max-w-lg grid-cols-4 px-1 pt-1">
        <Link
          href="/"
          className={tabBase}
          style={{
            color: isHome ? 'var(--accent-primary)' : 'var(--text-secondary)',
            backgroundColor: isHome ? 'color-mix(in srgb, var(--accent-primary) 12%, transparent)' : 'transparent',
          }}
        >
          <span className="text-xl leading-none">🏠</span>
          <span>Home</span>
        </Link>
        <Link
          href="/#search"
          className={tabBase}
          style={{
            color: isHome ? 'var(--accent-primary)' : 'var(--text-secondary)',
            backgroundColor: isHome ? 'color-mix(in srgb, var(--accent-primary) 12%, transparent)' : 'transparent',
          }}
        >
          <span className="text-xl leading-none">🔎</span>
          <span>Search</span>
        </Link>
        <Link
          href="/favourites"
          className={tabBase}
          style={{
            color: isFavourites ? 'var(--accent-primary)' : 'var(--text-secondary)',
            backgroundColor: isFavourites
              ? 'color-mix(in srgb, var(--accent-primary) 12%, transparent)'
              : 'transparent',
          }}
        >
          <span className="text-xl leading-none">❤️</span>
          <span>Favorites</span>
        </Link>
        <Link
          href="/account"
          className={tabBase}
          style={{
            color: isAccount ? 'var(--accent-primary)' : 'var(--text-secondary)',
            backgroundColor: isAccount
              ? 'color-mix(in srgb, var(--accent-primary) 12%, transparent)'
              : 'transparent',
          }}
        >
          <span className="text-xl leading-none">👤</span>
          <span>Account</span>
        </Link>
      </div>
    </nav>
  );
}

