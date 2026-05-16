'use client';

import { FOOD_CATEGORIES } from '@/constants/foodCategories';

const CATEGORY_ICON: Partial<Record<string, string>> = {
  'Sri Lankan': '🇱🇰',
  Indian: '🍛',
  Chinese: '🥟',
  Kottu: '🫓',
  Biryani: '🍚',
  'Rice & Curry': '🍛',
  'Fast Food': '🍟',
  Burgers: '🍔',
  Pizza: '🍕',
  Cafe: '☕',
  Dessert: '🍰',
  Asian: '🥢',
};

type HomeCategoryStripProps = {
  selected: string[];
  onToggle: (label: string) => void;
};

export function HomeCategoryStrip({ selected, onToggle }: HomeCategoryStripProps) {
  return (
    <div className="relative">
      <div className="flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FOOD_CATEGORIES.map((label) => {
          const active = selected.includes(label);
          const icon = CATEGORY_ICON[label] ?? '🍽';
          return (
            <button
              key={label}
              type="button"
              onClick={() => onToggle(label)}
              aria-pressed={active}
              className={`shrink-0 rounded-full border px-2.5 py-1 text-xs transition-colors duration-150 ${
                active ? 'font-medium' : 'font-normal'
              }`}
              style={{
                borderColor: active
                  ? 'color-mix(in srgb, var(--accent-primary) 45%, var(--border))'
                  : 'var(--border)',
                backgroundColor: active
                  ? 'color-mix(in srgb, var(--accent-primary) 10%, var(--surface))'
                  : 'transparent',
                color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
              }}
            >
              <span className="mr-1" aria-hidden>
                {icon}
              </span>
              {label}
            </button>
          );
        })}
      </div>
      <div
        className="pointer-events-none absolute right-0 top-0 h-full w-10"
        style={{ background: 'linear-gradient(to left, var(--surface), transparent)' }}
        aria-hidden
      />
    </div>
  );
}
