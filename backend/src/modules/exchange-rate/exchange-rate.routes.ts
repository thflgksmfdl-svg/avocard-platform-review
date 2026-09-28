import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { normalizePageQuery } from '../../shared/pagination.js';
import { listExchangeRates } from './exchange-rate.repository.js';
import { createExchangeRate } from './exchange-rate.service.js';

const createSchema = z.object({
  rate: z.string().regex(/^\d+(\.\d+)?$/, 'rate must be a positive decimal string'),
  effectiveAt: z.string().datetime(),
  currencyPair: z.string().optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

function toDto(rate: { id: string; currency_pair: string; rate: unknown; effective_at: Date; entered_by: string; created_at: Date }) {
  return {
    id: rate.id,
    currencyPair: rate.currency_pair,
    rate: rate.rate!.toString(),
    effectiveAt: rate.effective_at.toISOString(),
    enteredBy: rate.entered_by,
    createdAt: rate.created_at.toISOString(),
  };
}

export const exchangeRateRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/v1/admin/exchange-rates',
    { preHandler: fastify.verifyAdminSession },
    async (request, reply) => {
      const query = listQuerySchema.parse(request.query);
      const { page, pageSize, skip, take } = normalizePageQuery(query);
      const [items, total] = await listExchangeRates(fastify.prisma, skip, take);
      reply.send({ items: items.map(toDto), page, pageSize, total });
    },
  );

  fastify.post(
    '/api/v1/admin/exchange-rates',
    { preHandler: fastify.verifyAdminSession },
    async (request, reply) => {
      const body = createSchema.parse(request.body);
      const created = await createExchangeRate(
        fastify.prisma,
        { rate: body.rate, effectiveAt: new Date(body.effectiveAt), currencyPair: body.currencyPair },
        request.adminUser!.id,
        request.correlationId,
      );
      reply.status(201).send(toDto(created));
    },
  );
};
