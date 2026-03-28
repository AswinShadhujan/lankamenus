/**
 * One-off script to create an admin user.
 * Run from services/api with DATABASE_URL in .env:
 *
 *   pnpm ts-node -r dotenv/config scripts/create-admin-user.ts
 *
 * Creates user: email admin@localhost, password admin, role admin.
 * Login at /admin/login or /login with those credentials.
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const EMAIL = 'admin@localhost';
const PASSWORD = 'admin';
const ROLE = 'admin';

async function main() {
  const prisma = new PrismaClient();

  const existing = await prisma.users.findUnique({ where: { email: EMAIL } });
  if (existing) {
    console.log(`User ${EMAIL} already exists (id: ${existing.id}). Exiting.`);
    await prisma.$disconnect();
    process.exit(0);
  }

  const hashedPassword = await bcrypt.hash(PASSWORD, 10);

  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.users.create({
      data: {
        email: EMAIL,
        password: hashedPassword,
        name: 'Admin',
        role: ROLE,
      },
    });
    await tx.auth_providers.create({
      data: {
        provider: 'email',
        provider_id: EMAIL,
        user_id: u.id,
      },
    });
    return u;
  });

  console.log(`Admin user created: id=${user.id}, email=${user.email}, role=${user.role}`);
  console.log(`Login with email: ${EMAIL} and password: ${PASSWORD}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
