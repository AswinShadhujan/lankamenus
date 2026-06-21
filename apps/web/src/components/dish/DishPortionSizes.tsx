import type { DishPortion } from '@/types/menu';

type DishPortionSizesProps = {
  portions: DishPortion[];
};

/** Read-only portion sizes and prices on the dish detail page. */
export function DishPortionSizes({ portions }: DishPortionSizesProps) {
  const visible = [...portions]
    .filter((p) => p.is_available !== false)
    .sort((a, b) => a.sort_order - b.sort_order || a.price - b.price);

  if (visible.length === 0) {
    return null;
  }

  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <p
        className="mb-[10px] text-[10px] font-semibold uppercase sm:text-xs"
        style={{
          letterSpacing: '0.08em',
          color: 'var(--text-secondary)',
        }}
      >
        Sizes
      </p>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {visible.map((portion) => (
          <div
            key={portion.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              padding: '10px 16px',
              borderRadius: '0.5rem',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              minWidth: '100px',
            }}
          >
            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: 500,
                color: 'var(--text-secondary)',
              }}
            >
              {portion.name}
            </span>
            <span
              style={{
                fontSize: '0.95rem',
                fontWeight: 600,
                marginTop: '2px',
                color: 'var(--accent-secondary)',
              }}
            >
              LKR {Number(portion.price).toLocaleString()}
            </span>
            {portion.serves ? (
              <span
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--text-secondary)',
                  marginTop: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                👤 {portion.serves === 1 ? '1 person' : `${portion.serves} people`}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
