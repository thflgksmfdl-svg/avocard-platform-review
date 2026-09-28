import type { PrismaClient } from '@prisma/client';

export function listExchangeRates(prisma: PrismaClient, skip: number, take: number) {
  return Promise.all([
    prisma.exchangeRate.findMany({
      orderBy: { effective_at: 'desc' },
      skip,
      take,
    }),
    prisma.exchangeRate.count(),
  ]);
}

export function getLatestExchangeRate(prisma: PrismaClient) {
  return prisma.exchangeRate.findFirst({
    where: { effective_at: { lte: new Date() } },
    orderBy: { effective_at: 'desc' },
  });
}
