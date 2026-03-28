export type NearMeCoordsForLabel = {
  lat: number;
  lng: number;
  radius_km?: number;
} | null;

/**
 * Discovery rail location suffix — uses existing client state only (no I/O).
 * Prioritizes GPS over district; multiple districts → first name only.
 */
export function getLocationLabel(
  nearMeCoords: NearMeCoordsForLabel,
  selectedDistricts: string[],
): string | null {
  if (nearMeCoords) {
    return '📍 Near you';
  }
  if (selectedDistricts.length > 0) {
    return `📍 ${selectedDistricts[0]}`;
  }
  return null;
}
