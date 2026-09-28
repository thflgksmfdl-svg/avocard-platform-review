import type { PrismaClient } from '@prisma/client';

export function listOwnAddresses(prisma: PrismaClient, customerId: string) {
  return prisma.addressBook.findMany({
    where: { customer_id: customerId, deleted_at: null },
    orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
  });
}

export function findOwnAddressById(prisma: PrismaClient, customerId: string, id: string) {
  return prisma.addressBook.findFirst({
    where: { id, customer_id: customerId, deleted_at: null },
  });
}
