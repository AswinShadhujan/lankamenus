/**
 * Generate a grid of coordinates around a center for tile-based Places search.
 * Grid spacing ~1.5km; each tile is used with radius 1500m for Nearby Search.
 */

/** Approximate meters per degree at Sri Lanka latitude (~7°N). */
const METERS_PER_DEG_LAT = 110_574;
const METERS_PER_DEG_LNG_AT_7N = 110_500;

/**
 * Generate tile centers around (centerLat, centerLng).
 * @param centerLat Center latitude
 * @param centerLng Center longitude
 * @param spacingMeters Distance between tile centers (e.g. 1500)
 * @param gridHalfSize Half-size of grid (e.g. 2 => 5x5 = 25 tiles)
 */
export function generateTileGrid(
  centerLat: number,
  centerLng: number,
  spacingMeters: number,
  gridHalfSize: number,
): { lat: number; lng: number }[] {
  const degLat = spacingMeters / METERS_PER_DEG_LAT;
  const degLng =
    spacingMeters / (METERS_PER_DEG_LNG_AT_7N * Math.cos((centerLat * Math.PI) / 180));

  const tiles: { lat: number; lng: number }[] = [];
  for (let i = -gridHalfSize; i <= gridHalfSize; i++) {
    for (let j = -gridHalfSize; j <= gridHalfSize; j++) {
      tiles.push({
        lat: centerLat + i * degLat,
        lng: centerLng + j * degLng,
      });
    }
  }
  return tiles;
}

export const TILE_SPACING_METERS = 1500;
export const TILE_RADIUS_METERS = 1500;
export const DEFAULT_GRID_HALF_SIZE = 2; // 5x5 = 25 tiles per city
