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
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm transition-all duration-200 ${
                active
                  ? 'bg-white font-medium text-black shadow-md'
                  : 'border border-white/20 text-gray-300 hover:bg-white/10'
              }`}
            >
              <span className="mr-1.5" aria-hidden>
                {icon}
              </span>
              {label}
            </button>
          );
        })}
      </div>
      <div
        className="pointer-events-none absolute right-0 top-0 h-full w-10 bg-gradient-to-l from-neutral-950 to-transparent"
        aria-hidden
      />
    </div>
  );
}
