import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, DEV_CUSTOMER_HEADER } from './helpers/build-test-app.js';

describe('address book routes', () => {
  let app: FastifyInstance;
  const customerA = `test-a-${randomUUID()}`;
  const customerB = `test-b-${randomUUID()}`;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates, lists, updates, and soft-deletes an address', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/me/addresses',
      headers: { [DEV_CUSTOMER_HEADER]: customerA },
      payload: {
        addressType: 'PERSONAL',
        label: '집',
        recipientName: '홍길동',
        recipientPhone: '010-0000-0000',
        postalCode: '06134',
        address: '서울시 강남구',
      },
    });
    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.json();

    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/me/addresses',
      headers: { [DEV_CUSTOMER_HEADER]: customerA },
    });
    expect(listResponse.json()).toHaveLength(1);

    const updateResponse = await app.inject({
      method: 'PATCH',
      url: `/api/v1/me/addresses/${created.id}`,
      headers: { [DEV_CUSTOMER_HEADER]: customerA },
      payload: { label: '회사' },
    });
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json().label).toBe('회사');

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/api/v1/me/addresses/${created.id}`,
      headers: { [DEV_CUSTOMER_HEADER]: customerA },
    });
    expect(deleteResponse.statusCode).toBe(204);

    const listAfterDelete = await app.inject({
      method: 'GET',
      url: '/api/v1/me/addresses',
      headers: { [DEV_CUSTOMER_HEADER]: customerA },
    });
    expect(listAfterDelete.json()).toHaveLength(0);
  });

  it('blocks cross-customer access to another customer address', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/me/addresses',
      headers: { [DEV_CUSTOMER_HEADER]: customerA },
      payload: {
        addressType: 'PERSONAL',
        label: '집',
        postalCode: '06134',
        address: '서울시 강남구',
      },
    });
    const created = createResponse.json();

    const otherCustomerUpdate = await app.inject({
      method: 'PATCH',
      url: `/api/v1/me/addresses/${created.id}`,
      headers: { [DEV_CUSTOMER_HEADER]: customerB },
      payload: { label: '해킹시도' },
    });

    expect(otherCustomerUpdate.statusCode).toBe(404);
  });
});
