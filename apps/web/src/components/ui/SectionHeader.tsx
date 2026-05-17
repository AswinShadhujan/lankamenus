'use client';

type SectionHeaderProps = {
  title: string;
  className?: string;
};

export function SectionHeader({ title, className = '' }: SectionHeaderProps) {
  return (
    <h2
      className={`text-h3 ${className}`}
      style={{ color: '#000000' }}
    >
      {title}
    </h2>
  );
}
