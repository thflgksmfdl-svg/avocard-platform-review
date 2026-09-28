import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/env.js';

const base = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  ADMIN_SESSION_SECRET: 'x'.repeat(32),
};

describe('loadConfig production Shopify auth guard', () => {
  it('refuses to boot in production with SHOPIFY_AUTH_MODE=dev-stub', () => {
    expect(() =>
      loadConfig({ ...base, NODE_ENV: 'production', SHOPIFY_AUTH_MODE: 'dev-stub' } as NodeJS.ProcessEnv),
    ).toThrow(/dev-stub is not allowed when NODE_ENV=production/);
  });

  it('refuses to boot in production with an empty SHOPIFY_AUTH_MODE', () => {
    expect(() =>
      loadConfig({ ...base, NODE_ENV: 'production', SHOPIFY_AUTH_MODE: '' } as NodeJS.ProcessEnv),
    ).toThrow(/SHOPIFY_AUTH_MODE must be set when NODE_ENV=production/);
  });

  it('allows dev-stub in development', () => {
    expect(() =>
      loadConfig({ ...base, NODE_ENV: 'development', SHOPIFY_AUTH_MODE: 'dev-stub' } as NodeJS.ProcessEnv),
    ).not.toThrow();
  });

  it('allows an empty SHOPIFY_AUTH_MODE in development', () => {
    expect(() =>
      loadConfig({ ...base, NODE_ENV: 'development', SHOPIFY_AUTH_MODE: '' } as NodeJS.ProcessEnv),
    ).not.toThrow();
  });

  it('requires DATABASE_URL', () => {
    expect(() =>
      loadConfig({ NODE_ENV: 'development', ADMIN_SESSION_SECRET: base.ADMIN_SESSION_SECRET } as NodeJS.ProcessEnv),
    ).toThrow();
  });

  it('requires ADMIN_SESSION_SECRET', () => {
    expect(() =>
      loadConfig({ NODE_ENV: 'development', DATABASE_URL: base.DATABASE_URL } as NodeJS.ProcessEnv),
    ).toThrow();
  });
});
