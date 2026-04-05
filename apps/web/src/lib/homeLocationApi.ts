import type { UserLocationState } from '@/lib/homeUserLocation';

/**
 * One place to turn userLocation + Nearby toggle into API query params.
 * - Default: lat + lng only (bias), when granted.
 * - Nearby (nearbySortActive): lat + lng + radius_km (strict), when granted.
 */
export function buildHomeGeoQuery(
  userLocation: UserLocationState,
  nearbySortActive: boolean,
  radiusKm: number,
): Record<string, string | number> {
  if (userLocation.status !== 'granted') return {};
  if (nearbySortActive) {
    return {
      lat: userLocation.lat,
      lng: userLocation.lng,
      radius_km: radiusKm,
    };
  }
  return {
    lat: userLocation.lat,
    lng: userLocation.lng,
  };
}

/** District CSV + geo — shared base for rails, dishes, and (with extras) the grid. */
export function mergeDistrictAndGeo(
  districtNames: string[],
  geo: Record<string, string | number>,
): Record<string, string | number> {
  const out: Record<string, string | number> = { ...geo };
  if (districtNames.length > 0) {
    out.district = districtNames.join(',');
  }
  return out;
}
