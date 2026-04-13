import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

type IdLike = number | string;

type TableSpec = {
  name: string;
  count: () => Promise<number>;
  fetchBatch: (afterId: IdLike | null, take: number) => Promise<Record<string, unknown>[]>;
  insertBatch: (rows: Record<string, unknown>[]) => Promise<number>;
};

function omitKeys<T extends Record<string, unknown>>(row: T, keys: string[]): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...row };
  for (const key of keys) {
    delete copy[key];
  }
  return copy;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function resolveBatchSize(): number {
  const raw = Number(process.env.MIGRATE_BATCH_SIZE ?? 1000);
  if (!Number.isFinite(raw)) return 1000;
  if (raw < 500) return 500;
  if (raw > 1000) return 1000;
  return Math.floor(raw);
}

async function migrateTable(spec: TableSpec, batchSize: number): Promise<void> {
  const total = await spec.count();
  console.log(`\n[${spec.name}] Source rows: ${total}`);
  if (total === 0) {
    console.log(`[${spec.name}] Nothing to migrate`);
    return;
  }

  let afterId: IdLike | null = null;
  let processed = 0;
  let inserted = 0;
  let batchNo = 0;

  while (true) {
    const rows = await spec.fetchBatch(afterId, batchSize);
    if (rows.length === 0) break;

    batchNo += 1;
    const lastRow = rows[rows.length - 1];
    const nextCursor = lastRow.id as IdLike | undefined;
    if (nextCursor == null) {
      throw new Error(`[${spec.name}] Batch ${batchNo} missing id cursor`);
    }

    try {
      const created = await spec.insertBatch(rows);
      inserted += created;
      processed += rows.length;
      console.log(
        `[${spec.name}] Migrated ${processed} / ${total} (inserted ${inserted}, batch ${batchNo}, size ${rows.length})`,
      );
    } catch (error) {
      processed += rows.length;
      console.error(
        `[${spec.name}] Batch ${batchNo} failed (cursor <= ${String(nextCursor)}). Continuing...`,
      );
      console.error(error);
    }

    afterId = nextCursor;
  }

  console.log(`[${spec.name}] Done. Processed=${processed}, inserted=${inserted}, source=${total}`);
}

async function main(): Promise<void> {
  const productionUrl = getRequiredEnv('DATABASE_URL');
  const localUrl = getRequiredEnv('DATABASE_URL_LOCAL');
  const batchSize = resolveBatchSize();

  if (productionUrl === localUrl) {
    throw new Error('DATABASE_URL and DATABASE_URL_LOCAL are identical. Refusing to migrate.');
  }

  const source = new PrismaClient({
    datasources: { db: { url: localUrl } },
  });
  const target = new PrismaClient({
    datasources: { db: { url: productionUrl } },
  });

  try {
    await source.$connect();
    await target.$connect();
    console.log(`Starting migration with batch size ${batchSize}`);

    const tables: TableSpec[] = [
      // Base lookups first
      {
        name: 'districts',
        count: () => source.districts.count(),
        fetchBatch: (afterId, take) =>
          source.districts.findMany({
            where: afterId == null ? undefined : { id: { gt: String(afterId) } },
            orderBy: { id: 'asc' },
            take,
          }) as unknown as Promise<Record<string, unknown>[]>,
        insertBatch: async (rows) =>
          (await target.districts.createMany({
            data: rows as never[],
            skipDuplicates: true,
          })).count,
      },
      {
        name: 'cities',
        count: () => source.cities.count(),
        fetchBatch: (afterId, take) =>
          source.cities.findMany({
            where: afterId == null ? undefined : { id: { gt: Number(afterId) } },
            orderBy: { id: 'asc' },
            take,
          }) as unknown as Promise<Record<string, unknown>[]>,
        insertBatch: async (rows) =>
          (await target.cities.createMany({
            data: rows as never[],
            skipDuplicates: true,
          })).count,
      },
      // Principal entities
      {
        name: 'restaurants',
        count: () => source.restaurants.count(),
        fetchBatch: (afterId, take) =>
          source.restaurants.findMany({
            where: afterId == null ? undefined : { id: { gt: Number(afterId) } },
            orderBy: { id: 'asc' },
            take,
          }) as unknown as Promise<Record<string, unknown>[]>,
        insertBatch: async (rows) =>
          (await target.restaurants.createMany({
            data: rows
              .map((r) => omitKeys(r, ['popular_score', 'trending_score'])) as never[],
            skipDuplicates: true,
          })).count,
      },
      {
        name: 'users',
        count: () => source.users.count(),
        fetchBatch: (afterId, take) =>
          source.users.findMany({
            where: afterId == null ? undefined : { id: { gt: Number(afterId) } },
            orderBy: { id: 'asc' },
            take,
          }) as unknown as Promise<Record<string, unknown>[]>,
        insertBatch: async (rows) =>
          (await target.users.createMany({
            data: rows as never[],
            skipDuplicates: true,
          })).count,
      },
      // Restaurant hierarchy
      {
        name: 'menus',
        count: () => source.menus.count(),
        fetchBatch: (afterId, take) =>
          source.menus.findMany({
            where: afterId == null ? undefined : { id: { gt: Number(afterId) } },
            orderBy: { id: 'asc' },
            take,
          }) as unknown as Promise<Record<string, unknown>[]>,
        insertBatch: async (rows) =>
          (await target.menus.createMany({
            data: rows as never[],
            skipDuplicates: true,
          })).count,
      },
      {
        name: 'menu_sections',
        count: () => source.menu_sections.count(),
        fetchBatch: (afterId, take) =>
          source.menu_sections.findMany({
            where: afterId == null ? undefined : { id: { gt: Number(afterId) } },
            orderBy: { id: 'asc' },
            take,
          }) as unknown as Promise<Record<string, unknown>[]>,
        insertBatch: async (rows) =>
          (await target.menu_sections.createMany({
            data: rows as never[],
            skipDuplicates: true,
          })).count,
      },
      {
        name: 'menu_items',
        count: () => source.menu_items.count(),
        fetchBatch: (afterId, take) =>
          source.menu_items.findMany({
            where: afterId == null ? undefined : { id: { gt: Number(afterId) } },
            orderBy: { id: 'asc' },
            take,
          }) as unknown as Promise<Record<string, unknown>[]>,
        // Rows include explicit `id` from source — Postgres sequences are not advanced; run
        // scripts/sql/fix-menu-items-id-sequence.sql (and siblings for other tables) on target after import.
        insertBatch: async (rows) =>
          (await target.menu_items.createMany({
            data: rows as never[],
            skipDuplicates: true,
          })).count,
      },
      // Dependents
      {
        name: 'auth_providers',
        count: () => source.auth_providers.count(),
        fetchBatch: (afterId, take) =>
          source.auth_providers.findMany({
            where: afterId == null ? undefined : { id: { gt: Number(afterId) } },
            orderBy: { id: 'asc' },
            take,
          }) as unknown as Promise<Record<string, unknown>[]>,
        insertBatch: async (rows) =>
          (await target.auth_providers.createMany({
            data: rows as never[],
            skipDuplicates: true,
          })).count,
      },
      {
        name: 'favourites',
        count: () => source.favourites.count(),
        fetchBatch: (afterId, take) =>
          source.favourites.findMany({
            where: afterId == null ? undefined : { id: { gt: Number(afterId) } },
            orderBy: { id: 'asc' },
            take,
          }) as unknown as Promise<Record<string, unknown>[]>,
        insertBatch: async (rows) =>
          (await target.favourites.createMany({
            data: rows as never[],
            skipDuplicates: true,
          })).count,
      },
      {
        name: 'import_tiles_progress',
        count: () => source.import_tiles_progress.count(),
        fetchBatch: (afterId, take) =>
          source.import_tiles_progress.findMany({
            where: afterId == null ? undefined : { id: { gt: Number(afterId) } },
            orderBy: { id: 'asc' },
            take,
          }) as unknown as Promise<Record<string, unknown>[]>,
        insertBatch: async (rows) =>
          (await target.import_tiles_progress.createMany({
            data: rows as never[],
            skipDuplicates: true,
          })).count,
      },
    ];

    for (const table of tables) {
      await migrateTable(table, batchSize);
    }

    console.log('\nData migration completed.');
  } finally {
    await source.$disconnect();
    await target.$disconnect();
  }
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exitCode = 1;
});
