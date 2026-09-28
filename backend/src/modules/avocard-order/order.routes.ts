import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { normalizePageQuery } from '../../shared/pagination.js';
import { getOrCreateOwnProfile } from '../identity/customer-profile.service.js';
import { toOrderCustomerDto } from './dto/order.customer-dto.js';
import { toIntegrationAttemptDto, toOrderInternalDto } from './dto/order.internal-dto.js';
import { findAnyOrders, findIntegrationAttemptsForOrder, findOwnOrders } from './order.repository.js';
import { getAnyOrderOrThrow, getOwnOrderOrThrow, submitOrder } from './order.service.js';

const submitOrderSchema = z.object({
  customsType: z.enum(['PERSONAL', 'BUSINESS']),
  transportMode: z.enum(['SEA', 'AIR', 'LCL']),
  recipientSnapshot: z.record(z.unknown()),
  customerMemo: z.string().optional(),
  items: z
    .array(
      z.object({
        offerId: z.string().min(1),
        skuId: z.string().optional(),
        sellerId: z.string().min(1),
        titleZh: z.string().min(1),
        titleKo: z.string().optional(),
        imageUrl: z.string().optional(),
        productUrl: z.string().optional(),
        videoUrl: z.string().optional(),
        optionSnapshot: z.record(z.unknown()).optional(),
        qty: z.number().int().positive(),
        cnyUnitPrice: z.string().regex(/^\d+(\.\d+)?$/),
      }),
    )
    .min(1),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export const orderRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/api/v1/me/orders',
    { preHandler: fastify.verifyShopifyCustomer },
    async (request, reply) => {
      const body = submitOrderSchema.parse(request.body);
      const profile = await getOrCreateOwnProfile(fastify.prisma, request.shopifyCustomerId!);
      const order = await submitOrder(
        fastify.prisma,
        fastify.adapters.alibaba1688,
        profile.id,
        request.shopifyCustomerId!,
        body,
        request.correlationId,
      );
      reply.status(201).send(toOrderCustomerDto(order));
    },
  );

  fastify.get(
    '/api/v1/me/orders',
    { preHandler: fastify.verifyShopifyCustomer },
    async (request, reply) => {
      const query = listQuerySchema.parse(request.query);
      const { page, pageSize, skip, take } = normalizePageQuery(query);
      const profile = await getOrCreateOwnProfile(fastify.prisma, request.shopifyCustomerId!);
      const [items, total] = await findOwnOrders(fastify.prisma, profile.id, skip, take);
      reply.send({ items: items.map(toOrderCustomerDto), page, pageSize, total });
    },
  );

  fastify.get(
    '/api/v1/me/orders/:id',
    { preHandler: fastify.verifyShopifyCustomer },
    async (request, reply) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const profile = await getOrCreateOwnProfile(fastify.prisma, request.shopifyCustomerId!);
      const order = await getOwnOrderOrThrow(fastify.prisma, profile.id, params.id);
      reply.send(toOrderCustomerDto(order));
    },
  );

  fastify.get(
    '/api/v1/admin/orders',
    { preHandler: fastify.verifyAdminSession },
    async (request, reply) => {
      const query = listQuerySchema.parse(request.query);
      const { page, pageSize, skip, take } = normalizePageQuery(query);
      const [items, total] = await findAnyOrders(fastify.prisma, skip, take);
      reply.send({ items: items.map(toOrderInternalDto), page, pageSize, total });
    },
  );

  fastify.get(
    '/api/v1/admin/orders/:id',
    { preHandler: fastify.verifyAdminSession },
    async (request, reply) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const order = await getAnyOrderOrThrow(fastify.prisma, params.id);
      const attempts = await findIntegrationAttemptsForOrder(fastify.prisma, order.id);
      reply.send({
        order: toOrderInternalDto(order),
        integrationAttempts: attempts.map(toIntegrationAttemptDto),
      });
    },
  );
};
