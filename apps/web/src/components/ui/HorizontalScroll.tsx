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
      className={`hide-scrollbar overflow-x-auto scroll-smooth pb-2 [-webkit-overflow-scrolling:touch] -mx-4 ps-[max(1rem,env(safe-area-inset-left,0px))] pe-[max(1rem,env(safe-area-inset-right,0px))] sm:-mx-6 sm:ps-[max(1.5rem,env(safe-area-inset-left,0px))] sm:pe-[max(1.5rem,env(safe-area-inset-right,0px))] lg:-mx-8 lg:ps-[max(2rem,env(safe-area-inset-left,0px))] lg:pe-[max(2rem,env(safe-area-inset-right,0px))] xl:-mx-10 xl:ps-[max(2.5rem,env(safe-area-inset-left,0px))] xl:pe-[max(2.5rem,env(safe-area-inset-right,0px))] ${className}`}
      style={{ scrollbarWidth: 'none' }}
    >
      <div className="flex snap-x snap-mandatory items-stretch gap-3 sm:gap-4">{children}</div>
    </div>
  );
}

