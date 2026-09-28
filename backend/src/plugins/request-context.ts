import { randomUUID } from 'node:crypto';
import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    correlationId: string;
  }
}

const HEADER = 'x-request-id';

/**
 * Assigns a correlation ID to every request (reusing an inbound x-request-id
 * if present) so audit logs and integration attempt records can be traced
 * back to the request that triggered them.
 */
export const requestContextPlugin: FastifyPluginAsync = fp(async (fastify) => {
  fastify.addHook('onRequest', async (request, reply) => {
    const inbound = request.headers[HEADER];
    const correlationId = (Array.isArray(inbound) ? inbound[0] : inbound) ?? randomUUID();
    request.correlationId = correlationId;
    reply.header(HEADER, correlationId);
  });
});
