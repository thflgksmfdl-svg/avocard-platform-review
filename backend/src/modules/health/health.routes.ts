import type { FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async (_request, reply) => {
    try {
      await fastify.prisma.$queryRaw`SELECT 1`;
      reply.send({ status: 'ok', db: 'connected' });
    } catch {
      reply.status(503).send({ status: 'error', db: 'unreachable' });
    }
  });
};
