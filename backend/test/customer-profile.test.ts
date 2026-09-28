import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, DEV_CUSTOMER_HEADER } from './helpers/build-test-app.js';

describe('customer profile routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects requests without a dev customer id header', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/me/profile' });
    expect(response.statusCode).toBe(401);
  });

  it('creates a profile on first access and updates it', async () => {
    const shopifyCustomerId = `test-${randomUUID()}`;

    const getResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/me/profile',
      headers: { [DEV_CUSTOMER_HEADER]: shopifyCustomerId },
    });
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json().email).toBeNull();

    const patchResponse = await app.inject({
      method: 'PATCH',
      url: '/api/v1/me/profile',
      headers: { [DEV_CUSTOMER_HEADER]: shopifyCustomerId },
      payload: { email: 'customer@example.com', phone: '+821012345678' },
    });
    expect(patchResponse.statusCode).toBe(200);
    expect(patchResponse.json().email).toBe('customer@example.com');

    const getAgain = await app.inject({
      method: 'GET',
      url: '/api/v1/me/profile',
      headers: { [DEV_CUSTOMER_HEADER]: shopifyCustomerId },
    });
    expect(getAgain.json().phone).toBe('+821012345678');
  });
});
