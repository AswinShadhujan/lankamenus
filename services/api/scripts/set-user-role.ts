/**
 * Set a user's role by email.
 * Run from services/api with DATABASE_URL in .env:
 *
 *   pnpm ts-node -r dotenv/config scripts/set-user-role.ts <email> <role>
 *
 * Example:
 *   pnpm ts-node -r dotenv/config scripts/set-user-role.ts aswinshadhujan@gmail.com admin
 */

import { PrismaClient } from '@prisma/client';

async function main() {
  const [email, role] = process.argv.slice(2);
  if (!email || !role) {
    console.error('Usage: pnpm ts-node -r dotenv/config scripts/set-user-role.ts <email> <role>');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const user = await prisma.users.findUnique({ where: { email } });
  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  await prisma.users.update({
    where: { email },
    data: { role },
  });
  console.log(`Updated ${email} role to "${role}".`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
