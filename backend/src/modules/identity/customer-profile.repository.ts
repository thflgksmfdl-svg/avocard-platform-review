import type { PrismaClient } from '@prisma/client';

export function findOrCreateCustomerProfile(prisma: PrismaClient, shopifyCustomerId: string) {
  return prisma.customerProfile.upsert({
    where: { shopify_customer_id: shopifyCustomerId },
    update: {},
    create: { shopify_customer_id: shopifyCustomerId },
  });
}

export function findCustomerProfileById(prisma: PrismaClient, id: string) {
  return prisma.customerProfile.findUnique({ where: { id } });
}

export function listCustomerProfiles(prisma: PrismaClient, skip: number, take: number) {
  return Promise.all([
    prisma.customerProfile.findMany({
      skip,
      take,
      orderBy: { created_at: 'desc' },
      include: { _count: { select: { addresses: true } } },
    }),
    prisma.customerProfile.count(),
  ]);
}
