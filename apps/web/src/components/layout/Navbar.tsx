'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { SearchBar, type SearchScope } from '@/components/ui/SearchBar';
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
  const [searchScope, setSearchScope] = useState<SearchScope>('all');
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
    <header
      className={`sticky top-0 z-50 border-b transition-colors duration-200 ${
        isHome ? 'backdrop-blur-md supports-[backdrop-filter]:bg-[var(--background)]/80' : ''
      }`}
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}
    >
      <div
        className={`mx-auto flex max-w-screen-xl flex-col gap-3 px-4 py-3 sm:px-6 md:flex-row md:items-center md:gap-4 ${isHome ? 'md:py-3' : 'md:py-2'}`}
      >
        <Link
          href="/"
          className="order-1 flex min-w-0 shrink-0 items-center gap-2 text-h2 transition-opacity hover:opacity-90 active:opacity-80 sm:gap-3"
          style={{ color: 'var(--text-primary)' }}
        >
          <Image
            src="/logo.png"
            alt="Lankamenus"
            width={128}
            height={32}
            className="h-7 w-auto max-h-8 shrink-0 bg-transparent object-contain object-left sm:h-8"
            placeholder="empty"
            priority
          />
          <span className="min-w-0 truncate font-semibold tracking-tight">Lankamenus</span>
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
              placeholder={
                searchScope === 'dishes'
                  ? 'Search dishes…'
                  : searchScope === 'restaurants'
                    ? 'Search restaurants…'
                    : isHome
                      ? 'Search dishes or restaurants'
                      : 'Search dishes or restaurant name'
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

        <nav className="order-2 flex shrink-0 items-center justify-end gap-1 sm:gap-3 md:order-3 md:ml-auto">
          <Link
            href="/favourites"
            className="rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--surface)]"
            style={{ color: pathname === '/favourites' ? 'var(--accent-primary)' : 'var(--text-primary)' }}
            title="Favourites"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="md:hidden" aria-hidden>
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <span className="hidden text-small md:inline">Favourites</span>
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
                className="rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--surface)]"
                style={{ color: 'var(--text-primary)' }}
                title="Log in"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="md:hidden" aria-hidden>
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span className="hidden text-small md:inline">Log in</span>
              </Link>
              <Link
                href="/register"
                className="rounded-md px-2 py-1.5 text-small font-medium transition-colors md:px-3"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: '#fff',
                }}
                title="Sign up"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="md:hidden" aria-hidden>
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <line x1="20" y1="8" x2="20" y2="14" />
                  <line x1="23" y1="11" x2="17" y2="11" />
                </svg>
                <span className="hidden md:inline">Sign up</span>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
