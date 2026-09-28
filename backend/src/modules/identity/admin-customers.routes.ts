import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { normalizePageQuery } from '../../shared/pagination.js';
import { writeAuditLog } from '../audit/audit-log.service.js';
import { toAddressBookAdminListDto } from './dto/address-book.dto.js';
import { toCustomerProfileAdminDto } from './dto/customer-profile.dto.js';
import { listCustomerProfiles, findCustomerProfileById } from './customer-profile.repository.js';
import { listOwnAddresses } from './address-book.repository.js';
import { NotFoundError } from '../../shared/errors.js';

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export const adminCustomersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/v1/admin/customers',
    { preHandler: fastify.verifyAdminSession },
    async (request, reply) => {
      const query = listQuerySchema.parse(request.query);
      const { page, pageSize, skip, take } = normalizePageQuery(query);
      const [items, total] = await listCustomerProfiles(fastify.prisma, skip, take);
      reply.send({
        items: items.map((item) => ({
          ...toCustomerProfileAdminDto(item),
          addressCount: item._count.addresses,
        })),
        page,
        pageSize,
        total,
      });
    },
  );

  fastify.get(
    '/api/v1/admin/customers/:id',
    { preHandler: fastify.verifyAdminSession },
    async (request, reply) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const profile = await findCustomerProfileById(fastify.prisma, params.id);
      if (!profile) {
        throw new NotFoundError('Customer not found');
      }
      const addresses = await listOwnAddresses(fastify.prisma, profile.id);

      // Viewing a customer's full detail (including masked-but-present
      // sensitive fields) is itself an access worth auditing per
      // 06_EXCEPTIONS_SECURITY_OPERATIONS.md §6.
      await writeAuditLog(fastify.prisma, {
        entityType: 'customer_profile',
        entityId: profile.id,
        action: 'ADMIN_VIEW_DETAIL',
        actor: { type: 'ADMIN', id: request.adminUser!.id },
        correlationId: request.correlationId,
      });

      reply.send({
        profile: toCustomerProfileAdminDto(profile),
        addresses: addresses.map(toAddressBookAdminListDto),
      });
    },
  );
};
