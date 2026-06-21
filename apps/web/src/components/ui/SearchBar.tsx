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

/** Single input: pill border + accent focus (no gradient). */
const searchInputPillClass =
  'rounded-full border-[1.5px] border-[var(--border)] bg-[var(--surface)] outline-none transition-[border-color,box-shadow] focus:border-[var(--accent-primary)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent-primary)_15%,transparent)]';

/** Premium shell: same visual as input, focus moves to inner field via focus-within. */
const searchPremiumShellClass =
  'rounded-full border-[1.5px] border-[var(--border)] bg-[var(--surface)] outline-none transition-[border-color,box-shadow] focus-within:border-[var(--accent-primary)] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent-primary)_15%,transparent)]';

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
      <div className={className}>
        <div className={`flex min-h-[44px] w-full items-center gap-2.5 px-4 py-2 shadow-sm md:min-h-[48px] md:gap-3 md:px-5 md:py-2.5 ${searchPremiumShellClass}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5 shrink-0 md:size-[22px]" style={{ color: 'var(--text-secondary)' }} aria-hidden>
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
            className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none focus:ring-0 md:text-base"
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
                    <span className="select-none text-[10px] sm:text-xs" style={{ color: 'var(--text-secondary)' }} aria-hidden>
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
      </div>
    );
  }

  return (
    <div className={className}>
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
        className={`min-h-[48px] w-full px-4 py-3 text-base md:min-h-0 md:py-2.5 md:text-body ${searchInputPillClass}`}
        style={{
          color: 'var(--text-primary)',
        }}
      />
    </div>
  );
}
