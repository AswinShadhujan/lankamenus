'use client';

type SectionHeaderProps = {
  title: string;
  className?: string;
};

export function SectionHeader({ title, className = '' }: SectionHeaderProps) {
  return (
    <h2
      className={`text-h3 ${className}`}
      style={{ color: 'var(--text-primary)' }}
    >
      {title}
    </h2>
  );
}
