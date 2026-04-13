/**
 * Resync SERIAL sequences after bulk imports. Uses DATABASE_URL from services/api/.env
 * Usage: node scripts/run-fix-sequences-bulk.mjs
 */
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();
try {
  await prisma.$transaction([
    prisma.$executeRaw`
      SELECT setval(
        pg_get_serial_sequence('menus', 'id'),
        COALESCE((SELECT MAX(id) FROM menus), 0) + 1,
        false
      )
    `,
    prisma.$executeRaw`
      SELECT setval(
        pg_get_serial_sequence('menu_sections', 'id'),
        COALESCE((SELECT MAX(id) FROM menu_sections), 0) + 1,
        false
      )
    `,
    prisma.$executeRaw`
      SELECT setval(
        pg_get_serial_sequence('menu_items', 'id'),
        COALESCE((SELECT MAX(id) FROM menu_items), 0) + 1,
        false
      )
    `,
    prisma.$executeRaw`
      SELECT setval(
        pg_get_serial_sequence('restaurants', 'id'),
        COALESCE((SELECT MAX(id) FROM restaurants), 0) + 1,
        false
      )
    `,
    prisma.$executeRaw`
      SELECT setval(
        pg_get_serial_sequence('media_assets', 'id'),
        COALESCE((SELECT MAX(id) FROM media_assets), 0) + 1,
        false
      )
    `,
    prisma.$executeRaw`
      SELECT setval(
        pg_get_serial_sequence('homepage_banners', 'id'),
        COALESCE((SELECT MAX(id) FROM homepage_banners), 0) + 1,
        false
      )
    `,
  ]);
  console.log('All sequences synced in one transaction: menus, menu_sections, menu_items, restaurants, media_assets, homepage_banners');
} finally {
  await prisma.$disconnect();
}
