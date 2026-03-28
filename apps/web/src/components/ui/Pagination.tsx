'use client';

type PaginationProps = {
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
};

export function Pagination({ page, total, pageSize, onPageChange, className = '' }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  if (total <= pageSize && total > 0) {
    return (
      <p className={`text-center text-small ${className}`} style={{ color: 'var(--text-secondary)' }}>
        Showing {total} {total === 1 ? 'result' : 'results'}
      </p>
    );
  }

  return (
    <div className={`flex flex-col items-center gap-3 sm:flex-row sm:justify-between ${className}`}>
      <p className="text-small" style={{ color: 'var(--text-secondary)' }}>
        {total === 0 ? (
          'No results'
        ) : (
          <>
            Showing {start}–{end} of {total}
          </>
        )}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="min-h-[44px] min-w-[44px] rounded-lg border px-3 text-small font-medium transition-opacity disabled:opacity-40"
          style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
        >
          Prev
        </button>
        <span className="text-small tabular-nums" style={{ color: 'var(--text-primary)' }}>
          Page {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="min-h-[44px] min-w-[44px] rounded-lg border px-3 text-small font-medium transition-opacity disabled:opacity-40"
          style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
        >
          Next
        </button>
      </div>
    </div>
  );
}
