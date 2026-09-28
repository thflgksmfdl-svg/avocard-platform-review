import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { toAddressBookDto } from './dto/address-book.dto.js';
import { getOrCreateOwnProfile } from './customer-profile.service.js';
import { createAddress, listAddresses, softDeleteAddress, updateAddress } from './address-book.service.js';

const addressInputSchema = z.object({
  addressType: z.enum(['PERSONAL', 'BUSINESS']),
  label: z.string().min(1),
  recipientName: z.string().optional(),
  recipientPhone: z.string().optional(),
  customsClearanceNo: z.string().optional(),
  businessName: z.string().optional(),
  businessNo: z.string().optional(),
  postalCode: z.string().min(1),
  address: z.string().min(1),
  addressDetail: z.string().optional(),
  isDefault: z.boolean().optional(),
});

const addressUpdateSchema = addressInputSchema.partial();

export const addressBookRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/v1/me/addresses',
    { preHandler: fastify.verifyShopifyCustomer },
    async (request, reply) => {
      const profile = await getOrCreateOwnProfile(fastify.prisma, request.shopifyCustomerId!);
      const addresses = await listAddresses(fastify.prisma, profile.id);
      reply.send(addresses.map(toAddressBookDto));
    },
  );

  fastify.post(
    '/api/v1/me/addresses',
    { preHandler: fastify.verifyShopifyCustomer },
    async (request, reply) => {
      const body = addressInputSchema.parse(request.body);
      const profile = await getOrCreateOwnProfile(fastify.prisma, request.shopifyCustomerId!);
      const created = await createAddress(fastify.prisma, profile.id, body, request.correlationId);
      reply.status(201).send(toAddressBookDto(created));
    },
  );

  fastify.patch(
    '/api/v1/me/addresses/:id',
    { preHandler: fastify.verifyShopifyCustomer },
    async (request, reply) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = addressUpdateSchema.parse(request.body);
      const profile = await getOrCreateOwnProfile(fastify.prisma, request.shopifyCustomerId!);
      const updated = await updateAddress(fastify.prisma, profile.id, params.id, body, request.correlationId);
      reply.send(toAddressBookDto(updated));
    },
  );

  fastify.delete(
    '/api/v1/me/addresses/:id',
    { preHandler: fastify.verifyShopifyCustomer },
    async (request, reply) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const profile = await getOrCreateOwnProfile(fastify.prisma, request.shopifyCustomerId!);
      await softDeleteAddress(fastify.prisma, profile.id, params.id, request.correlationId);
      reply.status(204).send();
    },
  );
};
