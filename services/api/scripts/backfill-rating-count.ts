/**
 * Backfill `rating_count` from Google Place Details (`user_ratings_total`).
 *
 * Only processes rows where `rating_count = 0` AND `google_place_id` IS NOT NULL.
 * Rows with `rating_count > 0` are never touched.
 *
 * Rate limiting: min ~220ms between requests (≤5/sec). Retries: up to 3 attempts per place.
 *
 * Usage (from services/api):
 *   pnpm backfill:rating-count
 *   pnpm exec ts-node -r dotenv/config scripts/backfill-rating-count.ts
 *   pnpm exec ts-node -r dotenv/config scripts/backfill-rating-count.ts -- --limit=100
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GooglePlacesService } from '../src/integrations/google/google-places.service';
import { CacheService } from '../src/cache/cache.service';
import {
  CACHE_KEY_RESTAURANT,
  CACHE_PATTERN_RESTAURANTS_LIST,
} from '../src/cache/cache-keys';

const MIN_INTERVAL_MS = 220;
const MAX_RETRIES = 3;
const DETAILS_FIELDS = 'place_id,name,rating,user_ratings_total';

function parseArgs(): { limit: number | undefined } {
  const argv = process.argv.slice(2);
  const limitArg = argv.find((a) => a.startsWith('--limit='));
  if (limitArg) {
    const n = parseInt(limitArg.slice('--limit='.length), 10);
    if (!Number.isNaN(n) && n > 0) return { limit: n };
  }
  return { limit: undefined };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const { limit } = parseArgs();

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const prisma = app.get(PrismaService);
  const googlePlaces = app.get(GooglePlacesService);
  const cache = app.get(CacheService);

  if (!googlePlaces.isConfigured()) {
    console.error(
      'GOOGLE_PLACES_API_KEY is not set. Add it to .env and try again.',
    );
    await app.close();
    process.exit(1);
  }

  const where = {
    rating_count: 0,
    google_place_id: { not: null },
  };

  const totalMatching = await prisma.restaurants.count({ where });
  const rows = await prisma.restaurants.findMany({
    where,
    select: { id: true, google_place_id: true },
    orderBy: { id: 'asc' },
    take: limit,
  });

  console.log(
    `Found ${totalMatching} restaurant(s) with rating_count=0 and google_place_id set.`,
  );
  console.log(
    `Processing ${rows.length} row(s)${limit != null ? ` (limit ${limit})` : ''}.\n`,
  );

  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const updatedIds: number[] = [];
  let lastRequestAt = 0;

  async function throttle(): Promise<void> {
    const now = Date.now();
    const wait = Math.max(0, MIN_INTERVAL_MS - (now - lastRequestAt));
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
  }

  for (const row of rows) {
    const placeId = row.google_place_id!;

    let details: Awaited<
      ReturnType<GooglePlacesService['getPlaceDetails']>
    > = null;
    let lastError: string | undefined;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        await throttle();
        details = await googlePlaces.getPlaceDetails(placeId, {
          fields: DETAILS_FIELDS,
        });
        if (details) break;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
      if (attempt < MAX_RETRIES - 1) {
        await sleep(1000 * (attempt + 1));
      }
    }

    if (!details) {
      failed++;
      console.warn(
        `No place details after ${MAX_RETRIES} attempts: id=${row.id} place_id=${placeId}${lastError ? ` (${lastError})` : ''}`,
      );
      continue;
    }

    const raw = details.user_ratings_total;
    if (raw === undefined || raw === null) {
      console.warn(`No user_ratings_total in response: id=${row.id} place_id=${placeId}`);
      skipped++;
      continue;
    }

    const n = Math.floor(Number(raw));
    if (!Number.isFinite(n) || n < 0) {
      skipped++;
      continue;
    }

    if (n === 0) {
      skipped++;
      continue;
    }

    await prisma.restaurants.update({
      where: { id: row.id },
      data: { rating_count: n },
    });
    updated++;
    updatedIds.push(row.id);
    console.log(`Updated ${updated} / ${rows.length} restaurants`);
  }

  if (updated > 0 && cache.isConfigured()) {
    try {
      await cache.delByPattern(CACHE_PATTERN_RESTAURANTS_LIST);
      for (const id of updatedIds) {
        await cache.del(CACHE_KEY_RESTAURANT(id));
      }
    } catch (e) {
      console.warn('Cache invalidation warning:', (e as Error).message);
    }
  }

  console.log(
    `\nDone. Updated ${updated} / ${rows.length} restaurants (skipped ${skipped}, failed ${failed}).`,
  );

  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
