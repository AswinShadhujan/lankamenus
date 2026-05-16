'use client';

import { HOME_DISH_CATEGORIES } from '@/constants/homeDishCategories';

export type DishCategoryPillsProps = {
  selected: string | null;
  onSelect: (category: string | null) => void;
};

export function DishCategoryPills({ selected, onSelect }: DishCategoryPillsProps) {
  return (
    <ul
      className="hide-scrollbar m-0 flex list-none flex-nowrap gap-1.5 overflow-x-auto px-0 py-0 [-webkit-overflow-scrolling:touch]"
      style={{ scrollbarWidth: 'none' }}
      aria-label="Dish types"
    >
      {HOME_DISH_CATEGORIES.map(({ label, emoji }) => {
        const isSelected = selected === label;
        return (
          <li key={label} className="shrink-0">
            <button
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(isSelected ? null : label)}
              className="rounded-full border border-solid font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-secondary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
              style={{
                fontSize: '0.8125rem',
                fontWeight: 500,
                padding: '0.25rem 0.75rem',
                borderRadius: 9999,
                ...(isSelected
                  ? {
                      backgroundColor: 'var(--accent-primary)',
                      color: '#ffffff',
                      borderColor: 'var(--accent-primary)',
                      boxShadow: '0 4px 12px rgba(195, 0, 23, 0.25)',
                    }
                  : {
                      backgroundColor: 'var(--surface)',
                      color: 'var(--text-primary)',
                      borderColor: 'var(--border)',
                    }),
              }}
            >
              {emoji ? (
                <span className="mr-1 inline" aria-hidden>
                  {emoji}
                </span>
              ) : null}
              {label}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
