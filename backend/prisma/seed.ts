import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(__dirname, '..', '.env.local') });

const prisma = new PrismaClient();

/**
 * Dev-only seed data. Never run against production. The seed admin password
 * is intentionally simple and is only meant for local development.
 */
async function main() {
  const seedEmail = 'admin@avocard.local';
  const existing = await prisma.adminUser.findUnique({ where: { email: seedEmail } });

  if (!existing) {
    await prisma.adminUser.create({
      data: {
        email: seedEmail,
        password_hash: await argon2.hash('dev-only-password'),
        display_name: 'Dev Admin',
      },
    });
    console.log(`Seeded admin user: ${seedEmail} (see prisma/seed.ts for the dev password)`);
  }

  const latestRate = await prisma.exchangeRate.findFirst({ orderBy: { effective_at: 'desc' } });
  if (!latestRate) {
    await prisma.exchangeRate.create({
      data: {
        currency_pair: 'CNY_KRW',
        rate: '195.00',
        effective_at: new Date(),
        entered_by: 'seed-script',
      },
    });
    console.log('Seeded initial CNY_KRW exchange rate: 195.00');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
