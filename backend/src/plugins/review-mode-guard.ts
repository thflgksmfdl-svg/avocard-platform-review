import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { ForbiddenError } from '../shared/errors.js';

/**
 * When REVIEW_MODE=true, blocks write operations that are not needed for an
 * external reviewer to look at the admin screens: address deletion, and the
 * whole customer-facing /me namespace (reviewers only need the admin SPA;
 * /me/* additionally requires the dev-stub Shopify header to reach at all,
 * but this is a second, explicit layer rather than relying on that alone).
 *
 * Admin GET/POST routes used by the review screens (login, exchange-rate
 * create, customer/order viewing) stay enabled — the whole point of the
 * review is to see those work. Nothing here touches 1688/Jungpan/Shopify/
 * Channel Talk calls; those are already unconditionally stubbed.
 */
export const reviewModeGuardPlugin: FastifyPluginAsync = fp(async (fastify) => {
  if (!fastify.config.review.enabled) {
    return;
  }

  fastify.addHook('onRequest', async (request) => {
    if (request.url.startsWith('/api/v1/me/')) {
      throw new ForbiddenError('This endpoint is disabled in review mode.');
    }
    if (request.method === 'DELETE') {
      throw new ForbiddenError('Delete operations are disabled in review mode.');
    }
  });
});
