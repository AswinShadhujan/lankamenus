'use client';

import { CategoryChip } from './CategoryChip';
import { HorizontalScroll } from './HorizontalScroll';

type CategoryStripProps = {
  categories: string[];
  selectedCategory: string;
  onSelect: (category: string) => void;
};

export function CategoryStrip({
  categories,
  selectedCategory,
  onSelect,
}: CategoryStripProps) {
  return (
    <div>
      <div className="mb-3">
        <p className="text-small font-semibold" style={{ color: 'var(--text-primary)' }}>
          Categories
        </p>
      </div>
      <HorizontalScroll>
        {categories.map((c) => (
          <div key={c} className="flex-shrink-0">
            <CategoryChip
              label={c}
              selected={selectedCategory === c}
              onClick={() => onSelect(selectedCategory === c ? '' : c)}
            />
          </div>
        ))}
      </HorizontalScroll>
    </div>
  );
}

