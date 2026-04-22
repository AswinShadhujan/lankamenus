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
      className={`hide-scrollbar overflow-x-auto scroll-smooth pb-2 [-webkit-overflow-scrolling:touch] -mx-4 ps-[max(1rem,env(safe-area-inset-left,0px))] pe-[max(1rem,env(safe-area-inset-right,0px))] md:-mx-0 md:ps-0 md:pe-0 ${className}`}
      style={{ scrollbarWidth: 'none' }}
    >
      <div className="flex snap-x snap-mandatory gap-3 sm:gap-4">{children}</div>
    </div>
  );
}

