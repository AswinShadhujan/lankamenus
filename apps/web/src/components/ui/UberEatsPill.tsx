'use client';

import type { ReactNode } from 'react';

/** Uber Eats–style control accent */
export const UBER_EATS_ACCENT = '#C30017';
const INACTIVE_BORDER = '#333333';
const INACTIVE_TEXT = '#cccccc';

type UberEatsPillProps = {
  label: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
};

/**
 * Rounded pill for sort / filter rows (active: brand red, inactive: outline).
 */
export function UberEatsPill({
  label,
  selected,
  onClick,
  disabled = false,
}: UberEatsPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className="shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 enabled:hover:brightness-110 enabled:active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
      style={
        selected
          ? {
              backgroundColor: UBER_EATS_ACCENT,
              color: '#ffffff',
              border: '1px solid transparent',
            }
          : {
              backgroundColor: 'transparent',
              border: `1px solid ${INACTIVE_BORDER}`,
              color: INACTIVE_TEXT,
            }
      }
    >
      {label}
    </button>
  );
}

type UberEatsPillRowProps = {
  title: string;
  children: ReactNode;
  className?: string;
  /** e.g. “See all” → scroll to full list */
  trailingAction?: ReactNode;
};

/** Section label + horizontally scrollable pill strip (8px gap). */
export function UberEatsPillRow({
  title,
  children,
  className = '',
  trailingAction,
}: UberEatsPillRowProps) {
  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: '#999999' }}
        >
          {title}
        </p>
        {trailingAction ? <div className="shrink-0">{trailingAction}</div> : null}
      </div>
      <div className="flex gap-2 overflow-x-auto scroll-smooth pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
    </div>
  );
}
