'use client';

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-dashed py-12 px-6 text-center ${className}`}
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
    >
      <p className="text-h3 mb-1" style={{ color: 'var(--text-primary)' }}>
        {title}
      </p>
      {description && (
        <p className="text-small mb-4 max-w-sm" style={{ color: 'var(--text-secondary)' }}>
          {description}
        </p>
      )}
      {action}
    </div>
  );
}
