import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { AdminUser } from '@prisma/client';
import { UnauthorizedError } from '../shared/errors.js';

declare module 'fastify' {
  interface FastifyRequest {
    shopifyCustomerId?: string;
    adminUser?: Pick<AdminUser, 'id' | 'email' | 'display_name' | 'role'>;
  }
}

const ADMIN_SESSION_COOKIE = 'avocard_admin_session';

export const authPlugin: FastifyPluginAsync = fp(async (fastify) => {
  fastify.decorate('verifyShopifyCustomer', async (request: FastifyRequest) => {
    const result = await fastify.adapters.shopify.verifyCustomerSession({ headers: request.headers });
    request.shopifyCustomerId = result.shopifyCustomerId;
  });

  fastify.decorate('verifyAdminSession', async (request: FastifyRequest) => {
    const token = request.cookies[ADMIN_SESSION_COOKIE];
    if (!token) {
      throw new UnauthorizedError('No admin session');
    }

    const unsigned = request.unsignCookie(token);
    if (!unsigned.valid || !unsigned.value) {
      throw new UnauthorizedError('Invalid admin session');
    }

    const adminUserId = unsigned.value;
    const adminUser = await fastify.prisma.adminUser.findUnique({ where: { id: adminUserId } });

    if (!adminUser || !adminUser.is_active) {
      throw new UnauthorizedError('Admin session no longer valid');
    }

    request.adminUser = {
      id: adminUser.id,
      email: adminUser.email,
      display_name: adminUser.display_name,
      role: adminUser.role,
    };
  });
});

export { ADMIN_SESSION_COOKIE };

declare module 'fastify' {
  interface FastifyInstance {
    verifyShopifyCustomer: (request: FastifyRequest) => Promise<void>;
    verifyAdminSession: (request: FastifyRequest) => Promise<void>;
  }
}
