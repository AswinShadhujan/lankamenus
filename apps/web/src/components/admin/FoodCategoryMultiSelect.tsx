'use client';

import { FOOD_CATEGORIES } from '@/constants/foodCategories';

type Props = {
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
};

/**
 * Admin: toggle chips for restaurant categories (stored as `cuisine_tags` in API).
 */
export function FoodCategoryMultiSelect({ selected, onChange, disabled }: Props) {
  const set = new Set(selected);

  const toggle = (label: string) => {
    if (disabled) return;
    const next = new Set(selected);
    if (next.has(label)) next.delete(label);
    else next.add(label);
    onChange([...next]);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {FOOD_CATEGORIES.map((label) => {
          const isOn = set.has(label);
          return (
            <button
              key={label}
              type="button"
              disabled={disabled}
              onClick={() => toggle(label)}
              className={`min-h-[40px] rounded-full border px-3 py-2 text-xs font-medium transition-colors sm:min-h-[44px] sm:px-4 sm:text-sm ${
                disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
              }`}
              style={
                isOn
                  ? {
                      color: 'var(--background)',
                      backgroundColor: 'var(--accent-primary)',
                      borderColor: 'var(--accent-primary)',
                    }
                  : {
                      color: 'var(--text-primary)',
                      backgroundColor: 'transparent',
                      borderColor: 'var(--border)',
                    }
              }
            >
              {label}
            </button>
          );
        })}
      </div>
      {selected.length === 0 ? (
        <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Select categories (optional). Choose all that apply.
        </p>
      ) : null}
    </div>
  );
}
