'use client';

import { useCallback } from 'react';

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
        className={`flex min-h-[52px] w-full items-center gap-2 rounded-full border border-white/10 bg-[#111] px-4 py-3 shadow-md transition-shadow focus-within:ring-2 focus-within:ring-orange-500 focus-within:ring-offset-2 focus-within:ring-offset-[var(--background)] ${className}`}
      >
        <span className="shrink-0 text-gray-400" aria-hidden>
          🔍
        </span>
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
          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
        />
        <span className="hidden shrink-0 text-xs text-gray-400 sm:inline" aria-hidden>
          📍 Near you
        </span>
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
