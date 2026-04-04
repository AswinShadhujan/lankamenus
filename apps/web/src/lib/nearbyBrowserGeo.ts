/** Browser geolocation session state for Nearby sort. */

export const MAX_BROWSER_ACCURACY_METERS = 4000;

export function isBrowserGeolocationAccurateEnough(accuracyM: number | null | undefined): boolean {
  if (accuracyM == null || !Number.isFinite(accuracyM)) return false;
  return accuracyM <= MAX_BROWSER_ACCURACY_METERS;
}

export type NearbySessionGeoState = {
  lat: number;
  lng: number;
  radius_km: number;
  accuracyM?: number;
};

export function browserPositionToNearbyState(
  lat: number,
  lng: number,
  radiusKm: number,
  accuracyM: number,
): NearbySessionGeoState {
  return {
    lat,
    lng,
    radius_km: radiusKm,
    accuracyM,
  };
}
