'use client';

function NavigationIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="3 11 22 2 13 21 11 13 3 11" />
    </svg>
  );
}

type RestaurantDirectionsLinkProps = {
  googleMapsUrl: string;
};

export function RestaurantDirectionsLink({ googleMapsUrl }: RestaurantDirectionsLinkProps) {
  return (
    <a
      href={googleMapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      title="Open in Google Maps"
      className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium no-underline transition-colors hover:opacity-80"
      style={{ color: '#000000' }}
    >
      <span style={{ color: '#000000' }} aria-hidden>
        <NavigationIcon />
      </span>
      Directions
    </a>
  );
}
