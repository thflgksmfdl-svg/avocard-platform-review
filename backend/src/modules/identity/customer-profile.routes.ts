import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { toCustomerProfileDto } from './dto/customer-profile.dto.js';
import { getOrCreateOwnProfile, updateOwnProfile } from './customer-profile.service.js';

const updateProfileSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(1).optional(),
});

export const customerProfileRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/v1/me/profile',
    { preHandler: fastify.verifyShopifyCustomer },
    async (request, reply) => {
      const profile = await getOrCreateOwnProfile(fastify.prisma, request.shopifyCustomerId!);
      reply.send(toCustomerProfileDto(profile));
    },
  );

  fastify.patch(
    '/api/v1/me/profile',
    { preHandler: fastify.verifyShopifyCustomer },
    async (request, reply) => {
      const body = updateProfileSchema.parse(request.body);
      const profile = await updateOwnProfile(
        fastify.prisma,
        request.shopifyCustomerId!,
        body,
        request.correlationId,
      );
      reply.send(toCustomerProfileDto(profile));
    },
  );
};
