'use client';

type HorizontalScrollProps = {
  children: React.ReactNode;
  className?: string;
};

export function HorizontalScroll({
  children,
  className = '',
}: HorizontalScrollProps) {
  return (
    <div
      className={`hide-scrollbar overflow-x-auto scroll-smooth pb-2 [-webkit-overflow-scrolling:touch] -mx-4 px-4 md:-mx-0 md:px-0 ${className}`}
      style={{ scrollbarWidth: 'none' }}
    >
      <div className="flex snap-x snap-mandatory gap-4">{children}</div>
    </div>
  );
}

