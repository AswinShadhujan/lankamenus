/**
 * Import restaurants from Google Places API across Sri Lanka (tile-based).
 *
 * - Uses districts and cities tables; seeds them from predefined data if empty.
 * - Tile grids (~1.5km spacing, 1500m radius); up to 5 concurrent tile searches.
 * - Checkpointing: import_tiles_progress table; completed tiles are skipped on resume.
 * - Rate limiting preserved; retries on OVER_QUERY_LIMIT; marks failed after max retries.
 *
 * Usage (from services/api):
 *   pnpm import:restaurants
 *   pnpm import:restaurants -- --district colombo
 *   pnpm import:restaurants -- --city kandy
 *   pnpm import:restaurants -- --dry-run
 *
 * Requires GOOGLE_PLACES_API_KEY in .env. Run migrations first.
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GooglePlacesService } from '../src/integrations/google/google-places.service';
import { RestaurantsService } from '../src/restaurants/restaurants.service';
import type { GooglePlaceResult } from '../src/integrations/google/google-places.types';
import { SRI_LANKA_DISTRICTS } from '../src/locations/data/sri-lanka-districts';
import { SRI_LANKA_CITIES_SEED } from '../prisma/data/sri-lanka-cities';
import {
  generateTileGrid,
  TILE_SPACING_METERS,
  TILE_RADIUS_METERS,
  DEFAULT_GRID_HALF_SIZE,
} from './tile-utils';

const CONCURRENCY_LIMIT = 5;
const TILE_DELAY_MS = 1000;
const NEXT_PAGE_DELAY_MS = 2100;
const MAX_PAGES_PER_TILE = 3;
const OVER_QUERY_LIMIT_WAIT_MS = 60_000;
const MAX_TILE_RETRIES = 3;
const PROGRESS_STATUS = { pending: 'pending', completed: 'completed', failed: 'failed' } as const;

function parseArgs(): { dryRun: boolean; district: string | undefined; city: string | undefined } {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const getVal = (prefix: string): string | undefined => {
    const eq = argv.find((a) => a.startsWith(prefix + '='));
    if (eq) return eq.slice(prefix.length + 1).trim() || undefined;
    const i = argv.indexOf(prefix);
    if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1].trim();
    return undefined;
  };
  const district = getVal('--district');
  const city = getVal('--city');
  return { dryRun, district, city };
}

/** Progress table for checkpointing (requires prisma generate with import_tiles_progress). */
function getProgressTable(prisma: PrismaService): {
  findUnique: (args: { where: { district_city_tile_lat_tile_lng: { district: string; city: string; tile_lat: number; tile_lng: number } } }) => Promise<{ status: string } | null>;
  upsert: (args: { where: { district_city_tile_lat_tile_lng: { district: string; city: string; tile_lat: number; tile_lng: number } }; create: Record<string, unknown>; update: Record<string, unknown> }) => Promise<unknown>;
} {
  const t = (prisma as unknown as Record<string, unknown>).import_tiles_progress;
  if (!t || typeof (t as { findUnique?: unknown }).findUnique !== 'function') {
    throw new Error('Prisma client missing import_tiles_progress. Run: pnpm exec prisma generate');
  }
  return t as ReturnType<typeof getProgressTable>;
}

function validatePlace(place: GooglePlaceResult): boolean {
  if (!place.place_id?.trim()) return false;
  if (!place.name?.trim()) return false;
  const loc = place.geometry?.location;
  if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return false;
  if (loc.lat < -90 || loc.lat > 90 || loc.lng < -180 || loc.lng > 180) return false;
  return true;
}

/** Simple concurrency limiter: run at most `limit` tasks concurrently. */
function createLimiter(limit: number) {
  let running = 0;
  const waitQueue: (() => void)[] = [];
  const acquire = (): Promise<void> => {
    if (running < limit) {
      running++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      waitQueue.push(() => {
        running++;
        resolve();
      });
    });
  };
  const release = (): void => {
    running--;
    const next = waitQueue.shift();
    if (next) next();
  };
  return { acquire, release };
}

async function ensureSeed(prisma: PrismaService): Promise<void> {
  const cityCount = await prisma.cities.count();
  if (cityCount > 0) return;

  console.log('Cities table empty; seeding districts and cities...');
  await prisma.districts.createMany({
    data: SRI_LANKA_DISTRICTS.map((d) => ({ id: d.id, name: d.name })),
    skipDuplicates: true,
  });
  await prisma.cities.createMany({
    data: SRI_LANKA_CITIES_SEED.map((c) => ({
      name: c.name,
      district_id: c.district_id,
      latitude: c.latitude,
      longitude: c.longitude,
    })),
    skipDuplicates: true,
  });
  console.log(`Seeded ${SRI_LANKA_DISTRICTS.length} districts and ${SRI_LANKA_CITIES_SEED.length} cities.\n`);
}

interface TileJob {
  districtName: string;
  cityName: string;
  lat: number;
  lng: number;
}

interface TileResult {
  discovered: number;
  inserted: number;
  duplicates: number;
  invalid: number;
  failed: number;
  skipped: boolean; // true if tile was already completed (resume)
}

async function scanOneTile(
  prisma: PrismaService,
  googlePlaces: GooglePlacesService,
  restaurantsService: RestaurantsService,
  tile: TileJob,
  dryRun: boolean,
  limiter: { acquire: () => Promise<void>; release: () => void },
): Promise<TileResult> {
  await limiter.acquire();
  try {
    if (!dryRun) {
      const progress = getProgressTable(prisma);
      const existing = await progress.findUnique({
        where: {
          district_city_tile_lat_tile_lng: {
            district: tile.districtName,
            city: tile.cityName,
            tile_lat: tile.lat,
            tile_lng: tile.lng,
          },
        },
      });
      if (existing?.status === PROGRESS_STATUS.completed) {
        return { discovered: 0, inserted: 0, duplicates: 0, invalid: 0, failed: 0, skipped: true };
      }
    }

    let tileDiscovered = 0;
    let tileNew = 0;
    let tileDuplicates = 0;
    let tileInvalid = 0;
    let tileFailed = 0;
    let nextPageToken: string | undefined;
    let pageCount = 0;

    const fetchPage = async (): Promise<{ results: GooglePlaceResult[]; next_page_token?: string }> => {
      const data = await googlePlaces.nearbySearch({
        latitude: tile.lat,
        longitude: tile.lng,
        radiusMeters: TILE_RADIUS_METERS,
        pageToken: nextPageToken,
      });
      return {
        results: data.results || [],
        next_page_token: data.next_page_token,
      };
    };

    let done = false;
    while (!done && pageCount < MAX_PAGES_PER_TILE) {
      if (pageCount > 0) await new Promise((r) => setTimeout(r, NEXT_PAGE_DELAY_MS));

      let result: { results: GooglePlaceResult[]; next_page_token?: string };
      let lastErr: unknown;
      for (let attempt = 0; attempt <= MAX_TILE_RETRIES; attempt++) {
        try {
          result = await fetchPage();
          lastErr = undefined;
          break;
        } catch (err: unknown) {
          lastErr = err;
          const e = err as Error & { status?: string };
          if (e.status === 'REQUEST_DENIED' || e.status === 'INVALID_REQUEST') {
            throw err; // no retry
          }
          if (e.status === 'OVER_QUERY_LIMIT') {
            if (attempt < MAX_TILE_RETRIES) {
              await new Promise((r) => setTimeout(r, OVER_QUERY_LIMIT_WAIT_MS));
              continue;
            }
          }
          if (attempt === MAX_TILE_RETRIES) throw err;
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        }
      }
      if (lastErr !== undefined) throw lastErr;
      const res = result!;

      pageCount++;
      tileDiscovered += res.results.length;

      for (const place of res.results) {
        if (!validatePlace(place)) {
          tileInvalid++;
          continue;
        }
        const placeLoc = place.geometry!.location;
        const name = place.name!.trim();
        const addressLine1 = place.vicinity?.trim();
        const category = place.types?.[0]?.trim();
        const photoReference = place.photos?.[0]?.photo_reference?.trim();

        if (dryRun) {
          tileNew++;
          continue;
        }

        await googlePlaces.requestDelay();

        try {
          const { created } = await restaurantsService.upsertFromGooglePlace({
            googlePlaceId: place.place_id,
            name,
            addressLine1,
            city: tile.cityName,
            district: tile.districtName,
            latitude: placeLoc.lat,
            longitude: placeLoc.lng,
            rating: place.rating,
            ratingCount: place.user_ratings_total,
            category,
            photoReference,
          });
          if (created) tileNew++;
          else tileDuplicates++;
        } catch {
          tileFailed++;
        }
      }

      nextPageToken = res.next_page_token;
      done = !nextPageToken || pageCount >= MAX_PAGES_PER_TILE;
    }

    if (!dryRun) {
      const progress = getProgressTable(prisma);
      await progress.upsert({
        where: {
          district_city_tile_lat_tile_lng: {
            district: tile.districtName,
            city: tile.cityName,
            tile_lat: tile.lat,
            tile_lng: tile.lng,
          },
        },
        create: {
          district: tile.districtName,
          city: tile.cityName,
          tile_lat: tile.lat,
          tile_lng: tile.lng,
          status: PROGRESS_STATUS.completed,
          scanned_at: new Date(),
        },
        update: { status: PROGRESS_STATUS.completed, scanned_at: new Date() },
      });
    }

    return {
      discovered: tileDiscovered,
      inserted: tileNew,
      duplicates: tileDuplicates,
      invalid: tileInvalid,
      failed: tileFailed,
      skipped: false,
    };
  } finally {
    limiter.release();
  }
}

async function main() {
  const { dryRun, district: districtFilter, city: cityFilter } = parseArgs();

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const prisma = app.get(PrismaService);
  const googlePlaces = app.get(GooglePlacesService);
  const restaurantsService = app.get(RestaurantsService);

  if (!googlePlaces.isConfigured()) {
    console.error('GOOGLE_PLACES_API_KEY is not set. Add it to .env and try again.');
    await app.close();
    process.exit(1);
  }

  try {
    await ensureSeed(prisma);

    const where: {
      district_id?: string;
      name?: string | { equals: string; mode: 'insensitive' };
    } = {};
    if (districtFilter) where.district_id = districtFilter.trim().toLowerCase();
    if (cityFilter) where.name = { equals: cityFilter.trim(), mode: 'insensitive' };

    const cities = await prisma.cities.findMany({
      where: Object.keys(where).length ? where : undefined,
      include: { district: true },
      orderBy: [{ district_id: 'asc' }, { name: 'asc' }],
    });

    if (cities.length === 0) {
      console.error('No cities found. Use --district or --city to filter, or check seed data.');
      await app.close();
      process.exit(1);
    }

    const tiles: TileJob[] = [];
    for (const city of cities) {
      const districtName = city.district.name;
      const grid = generateTileGrid(
        city.latitude,
        city.longitude,
        TILE_SPACING_METERS,
        DEFAULT_GRID_HALF_SIZE,
      );
      for (const t of grid) {
        tiles.push({
          districtName,
          cityName: city.name,
          lat: t.lat,
          lng: t.lng,
        });
      }
    }

    if (dryRun) console.log('DRY RUN: no data will be written.\n');
    if (districtFilter) console.log(`District filter: ${districtFilter}`);
    if (cityFilter) console.log(`City filter: ${cityFilter}`);
    console.log(`Cities: ${cities.length} | Tiles: ${tiles.length} | Concurrency: ${CONCURRENCY_LIMIT}\n`);

    let totalDiscovered = 0;
    let totalInserted = 0;
    let totalDuplicates = 0;
    let totalInvalid = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    const limiter = createLimiter(CONCURRENCY_LIMIT);

    let nextTileIndex = 0;
    const delayBetweenStarts = TILE_DELAY_MS / CONCURRENCY_LIMIT;

    const processNextTile = async (): Promise<void> => {
      while (true) {
        const index = nextTileIndex++;
        if (index >= tiles.length) return;
        const tile = tiles[index];
        if (index > 0 && delayBetweenStarts > 0) {
          await new Promise((r) => setTimeout(r, delayBetweenStarts));
        }
        let result: TileResult;
        try {
          result = await scanOneTile(
            prisma,
            googlePlaces,
            restaurantsService,
            tile,
            dryRun,
            limiter,
          );
        } catch (err: unknown) {
          const e = err as Error & { status?: string };
          if (e.status === 'REQUEST_DENIED') {
            console.error('REQUEST_DENIED. Check API key and Places API enablement.');
            await app.close();
            process.exit(1);
          }
          if (e.status === 'INVALID_REQUEST') {
            console.warn(`  [${tile.districtName} → ${tile.cityName}] Tile ${tile.lat.toFixed(2)},${tile.lng.toFixed(2)} INVALID_REQUEST`);
          }
          if (!dryRun) {
            getProgressTable(prisma).upsert({
              where: {
                district_city_tile_lat_tile_lng: {
                  district: tile.districtName,
                  city: tile.cityName,
                  tile_lat: tile.lat,
                  tile_lng: tile.lng,
                },
              },
              create: {
                district: tile.districtName,
                city: tile.cityName,
                tile_lat: tile.lat,
                tile_lng: tile.lng,
                status: PROGRESS_STATUS.failed,
                scanned_at: null,
              },
              update: { status: PROGRESS_STATUS.failed },
            }).catch(() => {});
          }
          result = { discovered: 0, inserted: 0, duplicates: 0, invalid: 0, failed: 0, skipped: false };
        }
        totalDiscovered += result.discovered;
        totalInserted += result.inserted;
        totalDuplicates += result.duplicates;
        totalInvalid += result.invalid;
        totalFailed += result.failed;
        if (result.skipped) totalSkipped++;
        if (result.discovered > 0 && !result.skipped) {
          console.log(
            `[${tile.districtName} → ${tile.cityName}] Tile ${tile.lat.toFixed(2)},${tile.lng.toFixed(2)} → ${result.discovered} places (${result.inserted} new, ${result.duplicates} duplicates)`,
          );
        }
      }
    };

    const concurrency = Math.min(CONCURRENCY_LIMIT, tiles.length);
    await Promise.all(Array.from({ length: concurrency }, () => processNextTile()));

    console.log('\n--- Summary ---');
    console.log(`Restaurants discovered: ${totalDiscovered}`);
    if (!dryRun) {
      console.log(`Tiles skipped (already completed): ${totalSkipped}`);
      console.log(`Inserted: ${totalInserted}`);
      console.log(`Skipped (duplicates): ${totalDuplicates}`);
      console.log(`Skipped (invalid): ${totalInvalid}`);
      console.log(`Failed: ${totalFailed}`);
    } else {
      console.log(`Would import: ${totalInserted} (dry run)`);
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
