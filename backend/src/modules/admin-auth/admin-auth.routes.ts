import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { ADMIN_SESSION_COOKIE } from '../../plugins/auth.js';
import { authenticateAdmin } from './admin-auth.service.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const adminAuthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/v1/admin/auth/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const adminUser = await authenticateAdmin(fastify.prisma, body.email, body.password);

    reply.setCookie(ADMIN_SESSION_COOKIE, adminUser.id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: fastify.config.nodeEnv === 'production',
      path: '/',
      signed: true,
      maxAge: 60 * 60 * 8, // 8 hours
    });

    reply.send({
      id: adminUser.id,
      email: adminUser.email,
      displayName: adminUser.display_name,
      role: adminUser.role,
    });
  });

  fastify.post(
    '/api/v1/admin/auth/logout',
    { preHandler: fastify.verifyAdminSession },
    async (_request, reply) => {
      reply.clearCookie(ADMIN_SESSION_COOKIE, { path: '/' });
      reply.send({ ok: true });
    },
  );

  fastify.get('/api/v1/admin/auth/me', { preHandler: fastify.verifyAdminSession }, async (request, reply) => {
    reply.send(request.adminUser);
  });
};
