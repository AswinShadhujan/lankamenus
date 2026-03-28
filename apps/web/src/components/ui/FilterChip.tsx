'use client';

type FilterChipProps = {
  label: string;
  selected?: boolean;
  onClick: () => void;
  className?: string;
};

export function FilterChip({
  label,
  selected = false,
  onClick,
  className = '',
}: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full px-4 py-2 text-small font-medium transition-all duration-200 active:opacity-85 ${className}`}
      style={
        selected
          ? { backgroundColor: 'var(--accent-primary)', color: '#fff' }
          : {
              backgroundColor: 'var(--surface)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
            }
      }
      aria-pressed={selected}
    >
      {label}
    </button>
  );
}

