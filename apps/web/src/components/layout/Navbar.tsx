'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { SearchBar } from '@/components/ui/SearchBar';
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

export function Navbar({
  hasToken,
  isAdmin = false,
  onLogout,
  searchValue = '',
  onSearchChange,
  onSearchSubmit,
}: NavbarProps) {
  const pathname = usePathname();
  const { theme, toggleTheme, mounted: themeMounted } = useTheme();
  const [localQuery, setLocalQuery] = useState(searchValue);
  /** On `/`, URL `q` is debounced in MainLayout — keep a local draft so suggestions track keystrokes immediately. */
  const [homeDraft, setHomeDraft] = useState(searchValue);
  const [suggestOpen, setSuggestOpen] = useState(false);
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
  } = useCombinedSearch(searchDisplayValue);

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
    <header
      className={`sticky top-0 z-50 border-b transition-colors duration-200 ${
        isHome ? 'backdrop-blur-md supports-[backdrop-filter]:bg-[var(--background)]/80' : ''
      }`}
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}
    >
      <div
        className={`mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:px-6 md:flex-row md:items-center md:gap-4 ${isHome ? 'md:py-3' : 'md:py-2'}`}
      >
        <Link
          href="/"
          className="order-1 shrink-0 text-h2 transition-opacity hover:opacity-80"
          style={{ color: 'var(--text-primary)' }}
        >
          Lankamenus
        </Link>

        <div
          id="search"
          className="order-3 w-full min-w-0 md:order-2 md:flex md:flex-1 md:justify-center"
        >
          <div
            ref={searchShellRef}
            className={`relative w-full min-w-0 ${isHome ? 'md:mx-auto md:max-w-3xl' : 'md:mx-auto md:max-w-md'}`}
            onBlurCapture={handleSearchShellBlurCapture}
          >
            <SearchBar
              value={searchDisplayValue}
              onChange={handleSearchChangeWrapped}
              onSubmit={handleSearchSubmit}
              onFocus={openSuggestions}
              placeholder={isHome ? 'Search dishes or restaurants' : 'Search dishes or restaurant name'}
              className="w-full"
              variant={isHome ? 'premium' : 'default'}
            />
            {showSuggestPanel && (
              <SearchDropdown
                query={searchDisplayValue}
                data={combinedData}
                loading={combinedLoading}
                debouncing={combinedDebouncing}
                error={combinedError}
                onNavigate={handleDropdownNavigate}
              />
            )}
          </div>
        </div>

        <nav className="order-2 flex shrink-0 items-center justify-end gap-1 sm:gap-3 md:order-3 md:ml-auto">
          <Link
            href="/favourites"
            className="text-small rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--surface)]"
            style={{ color: pathname === '/favourites' ? 'var(--accent-primary)' : 'var(--text-primary)' }}
          >
            Favourites
          </Link>
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
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-md px-3 py-1.5 text-small font-medium transition-colors"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: '#fff',
                }}
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
