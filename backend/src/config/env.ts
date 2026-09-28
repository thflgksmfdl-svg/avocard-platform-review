import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  ADMIN_SESSION_SECRET: z.string().min(1, 'ADMIN_SESSION_SECRET is required'),
  ADMIN_APP_ORIGIN: z.string().min(1).default('http://localhost:5173'),

  // Review mode: serves the built admin SPA from this same Fastify process
  // (so a tunnel exposes one origin, avoiding CORS/cookie cross-site issues)
  // and disables write routes not needed for a read-mostly external review.
  // Never enable this together with NODE_ENV=production.
  REVIEW_MODE: z
    .string()
    .default('false')
    .transform((v) => v.trim().toLowerCase() === 'true'),
  ADMIN_STATIC_DIR: z.string().default(''),
  REVIEW_TUNNEL_ORIGIN: z.string().default(''),

  // Shopify customer session verification. `dev-stub` trusts a client-supplied
  // header and must never run in production — enforced below, not just by type.
  SHOPIFY_AUTH_MODE: z.string().default(''),
  SHOPIFY_SHOP_DOMAIN: z.string().default(''),
  SHOPIFY_STOREFRONT_PUBLIC_TOKEN: z.string().default(''),
  SHOPIFY_APP_PROXY_SHARED_SECRET: z.string().default(''),

  ALIBABA_1688_BASE_URL: z.string().default(''),
  ALIBABA_1688_APP_KEY: z.string().default(''),
  ALIBABA_1688_APP_SECRET: z.string().default(''),

  JUNGPAN_BASE_URL: z.string().default(''),
  JUNGPAN_SITE_CD: z.string().default(''),
  JUNGPAN_API_KEY: z.string().default(''),

  CHANNEL_TALK_API_KEY: z.string().default(''),
});

export type AppConfig = ReturnType<typeof loadConfig>;

/**
 * Parses and validates process.env, then applies the one hard business rule
 * that a zod type alone cannot express: production must never run with the
 * Shopify dev-stub auth adapter. Fails fast at boot, before any server starts
 * listening, rather than letting an unverifiable customer identity through.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid environment configuration:\n${issues.join('\n')}`);
  }

  const data = parsed.data;

  if (data.NODE_ENV === 'production' && data.SHOPIFY_AUTH_MODE.trim().toLowerCase() === 'dev-stub') {
    throw new Error(
      'SHOPIFY_AUTH_MODE=dev-stub is not allowed when NODE_ENV=production. ' +
        'Configure a real Shopify customer session verification adapter before running in production.',
    );
  }

  if (data.NODE_ENV === 'production' && data.SHOPIFY_AUTH_MODE.trim() === '') {
    throw new Error(
      'SHOPIFY_AUTH_MODE must be set when NODE_ENV=production. No Shopify customer session ' +
        'verification adapter is configured yet — see 08_OPEN_QUESTIONS_AND_BLOCKERS.md item P0-24.',
    );
  }

  if (data.REVIEW_MODE && data.NODE_ENV === 'production') {
    throw new Error('REVIEW_MODE must not be combined with NODE_ENV=production.');
  }

  if (data.REVIEW_MODE && !data.ADMIN_STATIC_DIR) {
    throw new Error('REVIEW_MODE=true requires ADMIN_STATIC_DIR to point at the built admin SPA (admin/dist).');
  }

  return {
    nodeEnv: data.NODE_ENV,
    port: data.PORT,
    logLevel: data.LOG_LEVEL,
    databaseUrl: data.DATABASE_URL,
    admin: {
      sessionSecret: data.ADMIN_SESSION_SECRET,
      appOrigin: data.ADMIN_APP_ORIGIN,
    },
    review: {
      enabled: data.REVIEW_MODE,
      adminStaticDir: data.ADMIN_STATIC_DIR,
      tunnelOrigin: data.REVIEW_TUNNEL_ORIGIN,
    },
    shopify: {
      authMode: data.SHOPIFY_AUTH_MODE,
      shopDomain: data.SHOPIFY_SHOP_DOMAIN,
      storefrontPublicToken: data.SHOPIFY_STOREFRONT_PUBLIC_TOKEN,
      appProxySharedSecret: data.SHOPIFY_APP_PROXY_SHARED_SECRET,
    },
    alibaba1688: {
      baseUrl: data.ALIBABA_1688_BASE_URL,
      appKey: data.ALIBABA_1688_APP_KEY,
      appSecret: data.ALIBABA_1688_APP_SECRET,
    },
    jungpan: {
      baseUrl: data.JUNGPAN_BASE_URL,
      siteCd: data.JUNGPAN_SITE_CD,
      apiKey: data.JUNGPAN_API_KEY,
    },
    channelTalk: {
      apiKey: data.CHANNEL_TALK_API_KEY,
    },
  };
}
