/**
 * One-off: align menu_items_id_seq with MAX(id). Requires DATABASE_URL in services/api/.env
 * Usage: node scripts/run-fix-menu-items-sequence.mjs
 */
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();
try {
  await prisma.$executeRaw`
    SELECT setval(
      pg_get_serial_sequence('menu_items', 'id'),
      COALESCE((SELECT MAX(id) FROM menu_items), 0) + 1,
      false
    )
  `;
  const rows = await prisma.$queryRaw`
    SELECT last_value, is_called FROM menu_items_id_seq
  `;
  console.log('menu_items id sequence updated. menu_items_id_seq:', rows);
} finally {
  await prisma.$disconnect();
}
