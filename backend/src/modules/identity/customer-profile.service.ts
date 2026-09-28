import type { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../../shared/errors.js';
import { writeAuditLog } from '../audit/audit-log.service.js';
import { findCustomerProfileById, findOrCreateCustomerProfile } from './customer-profile.repository.js';

export async function getOrCreateOwnProfile(prisma: PrismaClient, shopifyCustomerId: string) {
  return findOrCreateCustomerProfile(prisma, shopifyCustomerId);
}

export interface UpdateProfileInput {
  email?: string;
  phone?: string;
}

export async function updateOwnProfile(
  prisma: PrismaClient,
  shopifyCustomerId: string,
  input: UpdateProfileInput,
  correlationId?: string,
) {
  const before = await findOrCreateCustomerProfile(prisma, shopifyCustomerId);

  return prisma.$transaction(async (tx) => {
    const after = await tx.customerProfile.update({
      where: { id: before.id },
      data: {
        email: input.email ?? before.email,
        phone: input.phone ?? before.phone,
      },
    });

    await writeAuditLog(tx, {
      entityType: 'customer_profile',
      entityId: after.id,
      action: 'UPDATE_PROFILE',
      before: { email: before.email, phone: before.phone },
      after: { email: after.email, phone: after.phone },
      actor: { type: 'CUSTOMER', id: after.id },
      correlationId,
    });

    return after;
  });
}

export async function getProfileByIdOrThrow(prisma: PrismaClient, id: string) {
  const profile = await findCustomerProfileById(prisma, id);
  if (!profile) {
    throw new NotFoundError('Customer profile not found');
  }
  return profile;
}
