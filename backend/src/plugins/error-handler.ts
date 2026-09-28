import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../shared/errors.js';

export const errorHandlerPlugin: FastifyPluginAsync = fp(async (fastify) => {
  fastify.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message },
      });
      return;
    }

    if (error instanceof ZodError) {
      reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: error.issues.map((i) => i.message).join('; ') },
      });
      return;
    }

    // Fastify's own schema validation errors already carry a statusCode.
    const maybeStatusCode = (error as { statusCode?: unknown }).statusCode;
    if (typeof maybeStatusCode === 'number' && maybeStatusCode < 500) {
      const message = error instanceof Error ? error.message : 'Bad request';
      reply.status(maybeStatusCode).send({
        error: { code: 'BAD_REQUEST', message },
      });
      return;
    }

    request.log.error({ err: error, correlationId: request.correlationId }, 'Unhandled error');
    reply.status(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  });
});
