/** Always ask the device for a new fix (no silent reuse of cached positions). */
export const FRESH_GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0,
};

/** Session metadata only — never read back into request URLs; cleared when Nearby starts. */
export const LM_NEARBY_GEO_STORAGE_KEY = 'lm:nearbyGeoMetaV1';

export type NearbySessionCoords = {
  lat: number;
  lng: number;
  radius_km: number;
};

export function clearStoredNearbyGeoMeta(): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(LM_NEARBY_GEO_STORAGE_KEY);
    }
  } catch {
    /* private mode / quota */
  }
}

/** Call only after a successful Nearby geolocation — not used to populate API params. */
export function persistNearbyGeoMetaAfterSuccess(payload: NearbySessionCoords & { positionTimestamp: number }): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(
      LM_NEARBY_GEO_STORAGE_KEY,
      JSON.stringify({
        ...payload,
        storedAt: Date.now(),
        source: 'browser_getCurrentPosition_nearby_only',
      }),
    );
  } catch {
    /* noop */
  }
}

export function geolocationFailureMessage(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return 'Location permission denied. Allow location for Nearby, or use district filters instead.';
    case err.POSITION_UNAVAILABLE:
      return 'Could not determine your position. Check that location services are on and try again.';
    case err.TIMEOUT:
      return 'Location request timed out. Try again or use district filters instead.';
    default:
      return 'Could not get your location. Try again or use district filters instead.';
  }
}
