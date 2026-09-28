import argon2 from 'argon2';
import type { PrismaClient } from '@prisma/client';
import { UnauthorizedError } from '../../shared/errors.js';

export async function authenticateAdmin(prisma: PrismaClient, email: string, password: string) {
  const adminUser = await prisma.adminUser.findUnique({ where: { email } });

  if (!adminUser || !adminUser.is_active) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const passwordMatches = await argon2.verify(adminUser.password_hash, password);
  if (!passwordMatches) {
    throw new UnauthorizedError('Invalid email or password');
  }

  return adminUser;
}

export async function hashAdminPassword(password: string): Promise<string> {
  return argon2.hash(password);
}
