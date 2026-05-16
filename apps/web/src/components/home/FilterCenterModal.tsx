'use client';

import { useEffect, useState, type ReactNode } from 'react';

export type FilterCenterModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  onApply: () => void;
  onClear: () => void;
  children: ReactNode;
  /** Wider desktop card for dish-type and restaurant filter modals. */
  wide?: boolean;
};

export function FilterCenterModal({
  open,
  title,
  onClose,
  onApply,
  onClear,
  children,
  wide = false,
}: FilterCenterModalProps) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="filter-modal-title"
        className={`relative z-[101] flex max-h-[min(85vh,calc(100dvh-2rem))] w-[calc(100%-24px)] max-w-none flex-col overflow-hidden sm:w-full ${
          wide ? 'sm:max-w-[680px]' : 'sm:max-w-[560px]'
        }`}
        style={{
          background: 'var(--surface)',
          borderRadius: '1rem',
          boxShadow: '0 8px 40px rgba(0, 0, 0, 0.18)',
          padding: '1.5rem',
          transform: entered ? 'scale(1)' : 'scale(0.95)',
          opacity: entered ? 1 : 0,
          transition: 'transform 200ms ease-out, opacity 200ms ease-out',
        }}
      >
        <h2
          id="filter-modal-title"
          className="mb-4 shrink-0 text-base font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          {title}
        </h2>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">{children}</div>
        <div className="mt-4 shrink-0 space-y-2 pt-1">
          <button
            type="button"
            onClick={onApply}
            className="w-full rounded-lg py-2 text-sm font-medium transition-opacity hover:opacity-90 active:opacity-85"
            style={{
              background: 'var(--accent-primary)',
              color: '#ffffff',
            }}
          >
            Apply
          </button>
          <button
            type="button"
            onClick={onClear}
            className="w-full py-1 text-xs font-medium transition-opacity hover:opacity-80"
            style={{ color: 'var(--text-secondary)' }}
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
