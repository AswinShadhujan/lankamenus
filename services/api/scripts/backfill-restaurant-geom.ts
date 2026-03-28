/**
 * One-off script to set restaurants.geom from lat/lng for a single restaurant.
 * Run from services/api with DATABASE_URL in .env:
 *
 *   npx ts-node -r dotenv/config scripts/backfill-restaurant-geom.ts <id> <lat> <lng>
 *
 * Example (Colombo):
 *   npx ts-node -r dotenv/config scripts/backfill-restaurant-geom.ts 1 6.9271 79.8612
 */

import { PrismaClient, Prisma } from '@prisma/client';

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.error('Usage: npx ts-node -r dotenv/config scripts/backfill-restaurant-geom.ts <id> <lat> <lng>');
    process.exit(1);
  }

  const id = parseInt(args[0], 10);
  const lat = parseFloat(args[1]);
  const lng = parseFloat(args[2]);

  if (Number.isNaN(id) || id < 1) {
    console.error('Invalid id');
    process.exit(1);
  }
  if (Number.isNaN(lat) || lat < -90 || lat > 90) {
    console.error('Invalid lat (use -90 to 90)');
    process.exit(1);
  }
  if (Number.isNaN(lng) || lng < -180 || lng > 180) {
    console.error('Invalid lng (use -180 to 180)');
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    const result = await prisma.$executeRaw(
      Prisma.sql`
        UPDATE restaurants
        SET geom = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
        WHERE id = ${id}
      `,
    );
    console.log(`Updated geom for restaurant id ${id} (rows affected: ${result}).`);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
