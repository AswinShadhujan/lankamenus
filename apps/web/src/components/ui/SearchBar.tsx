'use client';

import { useCallback } from 'react';

export type SearchScope = 'all' | 'dishes' | 'restaurants';

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value?: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
  /** Home: prominent pill with icon + locality hint. */
  variant?: 'default' | 'premium';
  scope?: SearchScope;
  onScopeChange?: (scope: SearchScope) => void;
};

const SCOPE_LABELS: Record<SearchScope, string> = {
  all: 'All',
  dishes: 'Dishes',
  restaurants: 'Restaurants',
};

export function SearchBar({
  value,
  onChange,
  onSubmit,
  onFocus,
  onBlur,
  placeholder = 'Search…',
  className = '',
  'aria-label': ariaLabel = 'Search',
  variant = 'default',
  scope = 'all',
  onScopeChange,
}: SearchBarProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onSubmit?.(value);
      }
    },
    [onSubmit, value],
  );

  if (variant === 'premium') {
    return (
      <div
        className={`flex min-h-[56px] w-full items-center gap-3 rounded-full border px-5 py-3.5 shadow-lg transition-shadow focus-within:shadow-xl focus-within:ring-2 focus-within:ring-orange-500 focus-within:ring-offset-2 focus-within:ring-offset-[var(--background)] ${className}`}
        style={{
          borderColor: 'var(--border)',
          backgroundColor: 'var(--surface)',
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" style={{ color: 'var(--text-secondary)' }} aria-hidden>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          aria-label={ariaLabel}
          suppressHydrationWarning
          className="min-w-0 flex-1 bg-transparent text-base outline-none"
          style={{ color: 'var(--text-primary)' }}
        />
        {onScopeChange && (
          <div className="flex shrink-0 items-center gap-0.5 rounded-full border p-0.5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}>
            {(['all', 'dishes', 'restaurants'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onScopeChange(s)}
                className="rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors"
                style={{
                  backgroundColor: scope === s ? 'var(--accent-primary)' : 'transparent',
                  color: scope === s ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {SCOPE_LABELS[s]}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      placeholder={placeholder}
      aria-label={ariaLabel}
      suppressHydrationWarning
      className={`min-h-[48px] rounded-xl border px-4 py-3 text-base transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] md:min-h-0 md:rounded-lg md:py-2.5 md:text-body ${className}`}
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--border)',
        color: 'var(--text-primary)',
      }}
    />
  );
}
