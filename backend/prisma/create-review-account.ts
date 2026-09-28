import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(__dirname, '..', '.env.local') });

const prisma = new PrismaClient();

/**
 * Creates (or replaces) a single, clearly-named temporary review account,
 * separate from the seed admin@avocard.local account. Run again to rotate
 * the password; run scripts/delete-review-account.ts to remove it.
 *
 * Usage: tsx prisma/create-review-account.ts <email> <password>
 */
async function main() {
  const [, , email, password] = process.argv;
  if (!email || !password) {
    console.error('Usage: tsx prisma/create-review-account.ts <email> <password>');
    process.exitCode = 1;
    return;
  }

  const passwordHash = await argon2.hash(password);

  await prisma.adminUser.upsert({
    where: { email },
    create: { email, password_hash: passwordHash, display_name: 'External Reviewer (temporary)' },
    update: { password_hash: passwordHash, is_active: true },
  });

  console.log(`Review account ready: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
