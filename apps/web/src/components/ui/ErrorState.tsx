'use client';

type ErrorStateProps = {
  message: string;
  onRetry?: () => void;
  className?: string;
};

export function ErrorState({
  message,
  onRetry,
  className = '',
}: ErrorStateProps) {
  return (
    <div
      className={`rounded-xl border py-8 px-6 text-center ${className}`}
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
    >
      <p className="text-body font-medium" style={{ color: 'var(--accent-primary)' }}>
        {message}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg px-4 py-2 text-small font-medium transition-colors"
          style={{
            backgroundColor: 'var(--accent-primary)',
            color: '#fff',
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}
