import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { normalizePageQuery } from '../../shared/pagination.js';
import { getOrCreateOwnProfile } from '../identity/customer-profile.service.js';
import { toOrderCustomerDto } from './dto/order.customer-dto.js';
import {
  toAuditLogDto,
  toIntegrationAttemptDto,
  toOrderInternalDto,
  toOrderNoteDto,
} from './dto/order.internal-dto.js';
import {
  findAnyOrders,
  findAuditLogForOrder,
  findErrorSummariesForOrders,
  findIntegrationAttemptsForOrder,
  findNotesForOrder,
  findOwnOrders,
  listAdminUsers,
} from './order.repository.js';
import {
  addOrderNote,
  assignOrderOperator,
  getAnyOrderOrThrow,
  getOwnOrderOrThrow,
  submitOrder,
} from './order.service.js';

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

const adminListQuerySchema = listQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
  customerStatus: z
    .enum([
      'QUOTE_PENDING',
      'PAYMENT_PENDING',
      'PAID',
      'AWAITING_ARRIVAL',
      'ARRIVED',
      'ARRIVAL_ERROR',
      'AWAITING_SHIPMENT',
      'SHIPPED',
    ])
    .optional(),
  paymentMethod: z.enum(['CARD', 'BANK_TRANSFER']).optional(),
  assignedOperatorId: z.string().uuid().optional(),
  hasApiError: z.coerce.boolean().optional(),
  hasRefundInProgress: z.coerce.boolean().optional(),
  submittedFrom: z.coerce.date().optional(),
  submittedTo: z.coerce.date().optional(),
});

const assignOperatorSchema = z.object({
  operatorId: z.string().uuid().nullable(),
});

const addNoteSchema = z.object({
  body: z.string().trim().min(1).max(4000),
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
      const query = adminListQuerySchema.parse(request.query);
      const { page, pageSize, skip, take } = normalizePageQuery(query);
      const [items, total] = await findAnyOrders(fastify.prisma, skip, take, {
        search: query.search,
        customerStatus: query.customerStatus,
        paymentMethod: query.paymentMethod,
        assignedOperatorId: query.assignedOperatorId,
        hasApiError: query.hasApiError,
        hasRefundInProgress: query.hasRefundInProgress,
        submittedFrom: query.submittedFrom,
        submittedTo: query.submittedTo,
      });
      const errorSummaries = await findErrorSummariesForOrders(
        fastify.prisma,
        items.map((o) => o.id),
      );
      reply.send({
        items: items.map((o) => toOrderInternalDto(o, errorSummaries.get(o.id) ?? [])),
        page,
        pageSize,
        total,
      });
    },
  );

  fastify.get(
    '/api/v1/admin/orders/:id',
    { preHandler: fastify.verifyAdminSession },
    async (request, reply) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const order = await getAnyOrderOrThrow(fastify.prisma, params.id);
      const [attempts, notes, auditLog, errorSummaries] = await Promise.all([
        findIntegrationAttemptsForOrder(fastify.prisma, order.id),
        findNotesForOrder(fastify.prisma, order.id),
        findAuditLogForOrder(fastify.prisma, order.id),
        findErrorSummariesForOrders(fastify.prisma, [order.id]),
      ]);
      reply.send({
        order: toOrderInternalDto(order, errorSummaries.get(order.id) ?? []),
        integrationAttempts: attempts.map(toIntegrationAttemptDto),
        notes: notes.map(toOrderNoteDto),
        auditLog: auditLog.map(toAuditLogDto),
      });
    },
  );

  fastify.patch(
    '/api/v1/admin/orders/:id/assigned-operator',
    { preHandler: fastify.verifyAdminSession },
    async (request, reply) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = assignOperatorSchema.parse(request.body);
      const order = await assignOrderOperator(
        fastify.prisma,
        params.id,
        body.operatorId,
        { type: 'ADMIN', id: request.adminUser!.id },
        request.correlationId,
      );
      const full = await getAnyOrderOrThrow(fastify.prisma, order.id);
      reply.send(toOrderInternalDto(full));
    },
  );

  fastify.post(
    '/api/v1/admin/orders/:id/notes',
    { preHandler: fastify.verifyAdminSession },
    async (request, reply) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = addNoteSchema.parse(request.body);
      const note = await addOrderNote(
        fastify.prisma,
        params.id,
        body.body,
        { type: 'ADMIN', id: request.adminUser!.id },
        request.correlationId,
      );
      reply.status(201).send(toOrderNoteDto(note));
    },
  );

  fastify.get(
    '/api/v1/admin/operators',
    { preHandler: fastify.verifyAdminSession },
    async (_request, reply) => {
      const operators = await listAdminUsers(fastify.prisma);
      reply.send(
        operators.map((o) => ({ id: o.id, email: o.email, displayName: o.display_name })),
      );
    },
  );
};
