'use client';

import { useCallback } from 'react';
import type { SearchScope } from '@/types/search';

export type { SearchScope };

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
  scope = 'restaurants',
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
        className={`flex min-h-[56px] w-full items-center gap-3 rounded-full border px-5 py-3.5 shadow-sm transition-shadow focus-within:shadow-md focus-within:ring-2 focus-within:ring-[color-mix(in_srgb,var(--accent-primary)_65%,transparent)] focus-within:ring-offset-1 focus-within:ring-offset-[var(--background)] ${className}`}
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
          <div
            className="flex shrink-0 items-center gap-0.5 pl-1"
            role="group"
            aria-label="Search in"
          >
            {(['dishes', 'restaurants'] as const).map((s, i) => (
              <span key={s} className="flex items-center gap-0.5">
                {i > 0 && (
                  <span className="select-none text-[10px] opacity-40" style={{ color: 'var(--text-secondary)' }} aria-hidden>
                    ·
                  </span>
                )}
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onScopeChange(s)}
                  className="rounded px-1 py-0.5 text-[11px] font-medium transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-1"
                  style={{
                    color: scope === s ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    opacity: scope === s ? 1 : 0.75,
                    textDecoration: scope === s ? 'underline' : 'none',
                    textUnderlineOffset: '3px',
                    fontWeight: scope === s ? 600 : 500,
                  }}
                >
                  {SCOPE_LABELS[s]}
                </button>
              </span>
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
