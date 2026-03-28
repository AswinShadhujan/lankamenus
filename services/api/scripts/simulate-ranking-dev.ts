/**
 * Development-only: randomize rating_count / view_count and resync favorite_count from `favourites`.
 * Refused when NODE_ENV=production.
 *
 * Usage: pnpm run simulate:ranking:dev
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    // eslint-disable-next-line no-console
    console.error('Refused: simulate-ranking-dev must not run in production.');
    process.exit(1);
  }

  const rows = await prisma.restaurants.findMany({ select: { id: true } });

  for (const r of rows) {
    await prisma.restaurants.update({
      where: { id: r.id },
      data: {
        rating_count: randomInt(5, 200),
        view_count: randomInt(0, 5000),
      },
    });
  }

  await prisma.$executeRaw`
    UPDATE restaurants r
    SET favorite_count = COALESCE(
      (SELECT COUNT(*)::int FROM favourites f WHERE f.restaurant_id = r.id),
      0
    )
  `;

  // eslint-disable-next-line no-console
  console.log(`Simulated ranking counters for ${rows.length} restaurants.`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
