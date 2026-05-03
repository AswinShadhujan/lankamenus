'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { SearchBar } from '@/components/ui/SearchBar';
import type { SearchScope } from '@/types/search';
import { SearchDropdown } from '@/components/SearchDropdown';
import { useCombinedSearch } from '@/hooks/useCombinedSearch';

type NavbarProps = {
  hasToken: boolean;
  isAdmin?: boolean;
  onLogout: () => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onSearchSubmit?: (value: string) => void;
};

function NavbarThemeToggle() {
  const { theme, toggleTheme, mounted: themeMounted } = useTheme();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="rounded-md p-1.5 transition-colors hover:bg-[var(--surface)]"
      style={{ color: 'var(--text-secondary)' }}
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
  );
}

export function Navbar({
  hasToken,
  isAdmin = false,
  onLogout,
  searchValue = '',
  onSearchChange,
  onSearchSubmit,
}: NavbarProps) {
  const pathname = usePathname();
  const [localQuery, setLocalQuery] = useState(searchValue);
  /** On `/`, URL `q` is debounced in MainLayout — keep a local draft so suggestions track keystrokes immediately. */
  const [homeDraft, setHomeDraft] = useState(searchValue);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [searchScope, setSearchScope] = useState<SearchScope>('restaurants');
  const blurCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchShellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pathname === '/') setHomeDraft(searchValue);
    else setLocalQuery(searchValue);
  }, [pathname, searchValue]);

  const isHome = pathname === '/';
  const searchDisplayValue = isHome ? homeDraft : localQuery;

  const clearBlurTimer = useCallback(() => {
    if (blurCloseTimer.current) {
      clearTimeout(blurCloseTimer.current);
      blurCloseTimer.current = null;
    }
  }, []);

  const openSuggestions = useCallback(() => {
    clearBlurTimer();
    setSuggestOpen(true);
  }, [clearBlurTimer]);

  const scheduleCloseSuggestions = useCallback(() => {
    clearBlurTimer();
    blurCloseTimer.current = setTimeout(() => setSuggestOpen(false), 180);
  }, [clearBlurTimer]);

  useEffect(() => () => clearBlurTimer(), [clearBlurTimer]);

  /** Close dropdown on navigation (pathname segment changes). */
  useEffect(() => {
    setSuggestOpen(false);
    clearBlurTimer();
  }, [pathname, clearBlurTimer]);

  const {
    data: combinedData,
    loading: combinedLoading,
    debouncing: combinedDebouncing,
    error: combinedError,
  } = useCombinedSearch(searchDisplayValue, searchScope);

  const showSuggestPanel = suggestOpen && searchDisplayValue.trim().length >= 1;

  /** Click / tap outside search shell closes dropdown. */
  useEffect(() => {
    if (!showSuggestPanel) return;
    const onPointerDown = (e: PointerEvent) => {
      const root = searchShellRef.current;
      if (!root || root.contains(e.target as Node)) return;
      setSuggestOpen(false);
      clearBlurTimer();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [showSuggestPanel, clearBlurTimer]);

  const handleSearchChangeWrapped = useCallback(
    (v: string) => {
      if (!v.trim()) {
        setSuggestOpen(false);
        clearBlurTimer();
      } else {
        clearBlurTimer();
        setSuggestOpen(true);
      }
      if (isHome) {
        setHomeDraft(v);
        (onSearchChange ?? (() => {}))(v);
      } else {
        setLocalQuery(v);
      }
    },
    [isHome, onSearchChange, clearBlurTimer],
  );

  const handleSearchShellBlurCapture = useCallback(
    (e: React.FocusEvent) => {
      const next = e.relatedTarget as Node | null;
      if (next && searchShellRef.current?.contains(next)) return;
      scheduleCloseSuggestions();
    },
    [scheduleCloseSuggestions],
  );

  const handleSearchSubmit = (value?: string) => {
    setSuggestOpen(false);
    clearBlurTimer();
    const submitted = (value ?? searchDisplayValue).trim();
    onSearchSubmit?.(submitted);
  };

  const handleDropdownNavigate = useCallback(() => {
    setSuggestOpen(false);
    clearBlurTimer();
  }, [clearBlurTimer]);

  return (
    <header className="lm-header-tribal sticky top-0 z-50 transition-colors duration-200">
      <div
        className={`lm-header-tribal-inner mx-auto flex w-full max-w-none flex-col gap-2 px-4 py-2 sm:px-6 md:flex-row md:items-center md:gap-3 lg:px-8 xl:px-10 ${isHome ? 'md:py-2' : 'md:py-1.5'}`}
      >
        <div className="flex w-full min-w-0 items-center justify-between gap-2 md:w-auto md:justify-start md:gap-3">
          <Link
            href="/"
            className="lm-header-logo min-w-0 shrink-0 transition-opacity hover:opacity-90 active:opacity-80"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              textDecoration: 'none',
              background: 'transparent',
            }}
          >
            <span
              style={{
                display: 'block',
                lineHeight: 0,
                background: 'transparent',
              }}
            >
              <img
                src="/logo_cleaned_square.png"
                alt="Lankamenus"
                width={40}
                height={40}
                style={{
                  width: '40px',
                  height: '40px',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </span>
            <span
              className="min-w-0 truncate text-lg font-semibold leading-tight tracking-tight sm:text-xl"
              style={{ color: 'var(--accent-primary)' }}
            >
              Lankamenus
            </span>
          </Link>
          <div className="shrink-0 md:hidden">
            <NavbarThemeToggle />
          </div>
        </div>

        <div id="search" className="w-full min-w-0 md:flex md:flex-1 md:justify-center">
          <div
            ref={searchShellRef}
            className={`relative w-full min-w-0 ${isHome ? 'md:mx-auto md:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl' : 'md:mx-auto md:max-w-md'}`}
            onBlurCapture={handleSearchShellBlurCapture}
          >
            <SearchBar
              value={searchDisplayValue}
              onChange={handleSearchChangeWrapped}
              onSubmit={handleSearchSubmit}
              onFocus={openSuggestions}
              placeholder={
                searchScope === 'dishes'
                  ? 'Search dishes…'
                  : 'Search restaurants…'
              }
              className="w-full"
              variant={isHome ? 'premium' : 'default'}
              scope={searchScope}
              onScopeChange={setSearchScope}
            />
            {showSuggestPanel && (
              <SearchDropdown
                query={searchDisplayValue}
                data={combinedData}
                loading={combinedLoading}
                debouncing={combinedDebouncing}
                error={combinedError}
                scope={searchScope}
                onNavigate={handleDropdownNavigate}
              />
            )}
          </div>
        </div>

        <nav className="hidden md:flex md:ml-auto shrink-0 items-center justify-end gap-1 sm:gap-3">
          <Link
            href="/favourites"
            className="rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--surface)]"
            style={{ color: pathname === '/favourites' ? 'var(--accent-primary)' : 'var(--text-primary)' }}
            title="Favourites"
          >
            <span className="text-small">Favourites</span>
          </Link>
          <NavbarThemeToggle />
          {hasToken ? (
            <>
              {isAdmin && (
                <Link
                  href="/admin/restaurants"
                  className="text-small rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--surface)]"
                  style={{
                    color: pathname?.startsWith('/admin') ? 'var(--accent-primary)' : 'var(--text-primary)',
                  }}
                >
                  Admin
                </Link>
              )}
              <Link
                href="/account"
                className="text-small rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--surface)]"
                style={{ color: pathname === '/account' ? 'var(--accent-primary)' : 'var(--text-primary)' }}
              >
                Account
              </Link>
              <button
                type="button"
                onClick={onLogout}
                className="text-small rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--surface)]"
                style={{ color: 'var(--text-secondary)' }}
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-small rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--surface)]"
                style={{ color: 'var(--text-primary)' }}
                title="Log in"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="hidden rounded-md px-3 py-1.5 text-small font-medium text-center transition-colors hover:opacity-95 md:block"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: '#fff',
                }}
                title="Sign up"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
