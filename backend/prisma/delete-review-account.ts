import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(__dirname, '..', '.env.local') });

const prisma = new PrismaClient();

/**
 * Deletes a review account created by create-review-account.ts.
 * admin_user rows have no soft-delete concept (they aren't a business
 * record covered by the "no hard delete" rule in 06_EXCEPTIONS_SECURITY_
 * OPERATIONS.md — that rule applies to payment/wallet/audit data), so this
 * is a real DELETE, appropriate for a throwaway credential.
 *
 * Usage: tsx prisma/delete-review-account.ts <email>
 */
async function main() {
  const [, , email] = process.argv;
  if (!email) {
    console.error('Usage: tsx prisma/delete-review-account.ts <email>');
    process.exitCode = 1;
    return;
  }

  const deleted = await prisma.adminUser.deleteMany({ where: { email } });
  console.log(deleted.count > 0 ? `Deleted review account: ${email}` : `No account found for: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
