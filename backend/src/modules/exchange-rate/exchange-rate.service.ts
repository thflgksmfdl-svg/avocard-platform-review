import type { PrismaClient } from '@prisma/client';
import { writeAuditLog } from '../audit/audit-log.service.js';

export interface CreateExchangeRateInput {
  rate: string;
  effectiveAt: Date;
  currencyPair?: string;
}

/**
 * Inserts a new exchange_rate row. There is deliberately no update function —
 * exchange_rate is insert-only per 09_CANONICAL_DECISIONS.md; corrections are
 * made by inserting a new row with a later effective_at, never by mutating
 * an existing one.
 */
export async function createExchangeRate(
  prisma: PrismaClient,
  input: CreateExchangeRateInput,
  enteredBy: string,
  correlationId?: string,
) {
  return prisma.$transaction(async (tx) => {
    const created = await tx.exchangeRate.create({
      data: {
        currency_pair: input.currencyPair ?? 'CNY_KRW',
        rate: input.rate,
        effective_at: input.effectiveAt,
        entered_by: enteredBy,
      },
    });

    await writeAuditLog(tx, {
      entityType: 'exchange_rate',
      entityId: created.id,
      action: 'CREATE',
      after: { rate: created.rate.toString(), effectiveAt: created.effective_at },
      actor: { type: 'ADMIN', id: enteredBy },
      correlationId,
    });

    return created;
  });
}
