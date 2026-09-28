import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import staticPlugin from '@fastify/static';
import path from 'node:path';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { AppConfig } from './config/env.js';
import { buildLoggerOptions } from './config/logger.js';
import { prismaPlugin } from './plugins/prisma.js';
import { requestContextPlugin } from './plugins/request-context.js';
import { errorHandlerPlugin } from './plugins/error-handler.js';
import { authPlugin } from './plugins/auth.js';
import { reviewModeGuardPlugin } from './plugins/review-mode-guard.js';
import { ShopifyDevStubAdapter } from './integrations/shopify/shopify.adapter.dev-stub.js';
import type { ShopifyPort } from './integrations/shopify/shopify.port.js';
import { Alibaba1688StubAdapter } from './integrations/alibaba1688/alibaba1688.adapter.stub.js';
import { JungpanStubAdapter } from './integrations/jungpan/jungpan.adapter.stub.js';
import { ChannelTalkStubAdapter } from './integrations/channel-talk/channel-talk.adapter.stub.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { adminAuthRoutes } from './modules/admin-auth/admin-auth.routes.js';
import { customerProfileRoutes } from './modules/identity/customer-profile.routes.js';
import { addressBookRoutes } from './modules/identity/address-book.routes.js';
import { adminCustomersRoutes } from './modules/identity/admin-customers.routes.js';
import { exchangeRateRoutes } from './modules/exchange-rate/exchange-rate.routes.js';
import { orderRoutes } from './modules/avocard-order/order.routes.js';
import type { Alibaba1688Port } from './integrations/alibaba1688/alibaba1688.port.js';
import type { JungpanPort } from './integrations/jungpan/jungpan.port.js';
import type { ChannelTalkPort } from './integrations/channel-talk/channel-talk.port.js';

export interface Adapters {
  shopify: ShopifyPort;
  alibaba1688: Alibaba1688Port;
  jungpan: JungpanPort;
  channelTalk: ChannelTalkPort;
}

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
    adapters: Adapters;
  }
}

/**
 * Builds the Shopify adapter for the current environment. Production must
 * never receive the dev-stub adapter — config/env.ts already refuses to
 * boot with SHOPIFY_AUTH_MODE=dev-stub in production, and this is a second,
 * independent guard at the point the adapter is actually constructed.
 */
function buildShopifyAdapter(config: AppConfig): ShopifyPort {
  if (config.nodeEnv === 'production') {
    throw new Error(
      'No production Shopify customer session verification adapter is implemented yet. ' +
        'Refusing to start in production without one — see 08_OPEN_QUESTIONS_AND_BLOCKERS.md P0-24.',
    );
  }
  return new ShopifyDevStubAdapter();
}

export async function buildApp(config: AppConfig): Promise<FastifyInstance> {
  const fastify = Fastify({ logger: buildLoggerOptions(config) });

  fastify.decorate('config', config);
  fastify.decorate('adapters', {
    shopify: buildShopifyAdapter(config),
    alibaba1688: new Alibaba1688StubAdapter(),
    jungpan: new JungpanStubAdapter(config.jungpan),
    channelTalk: new ChannelTalkStubAdapter(),
  });

  // In review mode the admin SPA is served from this same origin (see below),
  // so browser requests never need cross-origin CORS at all. The allowlist
  // still includes the tunnel origin defensively (e.g. direct API testing
  // by the reviewer), never a wildcard.
  const corsOrigins = [config.admin.appOrigin, config.review.tunnelOrigin].filter(Boolean);
  await fastify.register(cors, { origin: corsOrigins, credentials: true });
  await fastify.register(cookie, { secret: config.admin.sessionSecret });
  await fastify.register(requestContextPlugin);
  await fastify.register(errorHandlerPlugin);
  await fastify.register(prismaPlugin);
  await fastify.register(authPlugin);
  await fastify.register(reviewModeGuardPlugin);

  await fastify.register(healthRoutes);
  await fastify.register(adminAuthRoutes);
  await fastify.register(customerProfileRoutes);
  await fastify.register(addressBookRoutes);
  await fastify.register(adminCustomersRoutes);
  await fastify.register(exchangeRateRoutes);
  await fastify.register(orderRoutes);

  if (config.review.enabled) {
    // Serves the built admin SPA (admin/dist) from this same process so an
    // external tunnel exposes exactly one HTTPS origin. This never serves
    // backend source files — only the pre-built, static admin/dist output.
    await fastify.register(staticPlugin, {
      root: path.resolve(config.review.adminStaticDir),
      prefix: '/',
      wildcard: false,
    });

    fastify.setNotFoundHandler((request, reply) => {
      if (request.method === 'GET' && !request.url.startsWith('/api/')) {
        reply.sendFile('index.html');
        return;
      }
      reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } });
    });
  }

  return fastify;
}
