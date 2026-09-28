import type { PrismaClient } from '@prisma/client';

export function findOwnOrders(prisma: PrismaClient, customerId: string, skip: number, take: number) {
  return Promise.all([
    prisma.avocardOrder.findMany({
      where: { customer_id: customerId, hidden_at: null },
      include: { items: true },
      orderBy: { created_at: 'desc' },
      skip,
      take,
    }),
    prisma.avocardOrder.count({ where: { customer_id: customerId, hidden_at: null } }),
  ]);
}

export function findOwnOrderById(prisma: PrismaClient, customerId: string, id: string) {
  return prisma.avocardOrder.findFirst({
    where: { id, customer_id: customerId },
    include: { items: true },
  });
}

export function findAnyOrders(prisma: PrismaClient, skip: number, take: number) {
  return Promise.all([
    prisma.avocardOrder.findMany({
      include: { items: true, customer: true },
      orderBy: { created_at: 'desc' },
      skip,
      take,
    }),
    prisma.avocardOrder.count(),
  ]);
}

export function findAnyOrderById(prisma: PrismaClient, id: string) {
  return prisma.avocardOrder.findUnique({
    where: { id },
    include: { items: true, customer: true },
  });
}

export function findIntegrationAttemptsForOrder(prisma: PrismaClient, orderId: string) {
  return prisma.integrationAttempt.findMany({
    where: { business_key: { startsWith: `${orderId}:` } },
    orderBy: { created_at: 'asc' },
  });
}
