'use client';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

type MatchHighlightProps = {
  text: string;
  query: string;
  className?: string;
};

/** Highlights the first case-insensitive occurrence of `query` in `text`. */
export function MatchHighlight({ text, query, className = '' }: MatchHighlightProps) {
  const q = query.trim();
  if (!q) {
    return <span className={className}>{text}</span>;
  }

  const parts = text.split(new RegExp(`(${escapeRegExp(q)})`, 'gi'));
  const qLower = q.toLowerCase();

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.toLowerCase() === qLower ? (
          <mark
            key={i}
            className="rounded-sm px-0.5 font-medium"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--accent-primary) 28%, transparent)',
              color: 'var(--text-primary)',
            }}
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}
