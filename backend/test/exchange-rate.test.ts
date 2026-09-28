import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from './helpers/build-test-app.js';
import { createAdminSessionCookie } from './helpers/admin-session.js';

describe('exchange rate routes', () => {
  let app: FastifyInstance;
  let cookieHeader: string;

  beforeAll(async () => {
    app = await buildTestApp();
    ({ cookieHeader } = await createAdminSessionCookie(app));
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires admin auth', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/admin/exchange-rates' });
    expect(response.statusCode).toBe(401);
  });

  it('creates and lists exchange rates ordered by effective_at desc, and exposes no update route', async () => {
    const create1 = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/exchange-rates',
      headers: { cookie: cookieHeader },
      payload: { rate: '190.50', effectiveAt: new Date('2026-01-01T01:00:00Z').toISOString() },
    });
    expect(create1.statusCode).toBe(201);

    const create2 = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/exchange-rates',
      headers: { cookie: cookieHeader },
      payload: { rate: '191.00', effectiveAt: new Date('2026-01-01T05:00:00Z').toISOString() },
    });
    expect(create2.statusCode).toBe(201);

    // pageSize is large enough to include both rows regardless of other
    // (e.g. seeded) exchange_rate rows already in the dev database — this
    // test only asserts the relative order of the two rows it created.
    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/exchange-rates?pageSize=100',
      headers: { cookie: cookieHeader },
    });
    const body = list.json();
    const created1 = body.items.find((item: { id: string }) => item.id === create1.json().id);
    const created2 = body.items.find((item: { id: string }) => item.id === create2.json().id);
    const index1 = body.items.indexOf(created1);
    const index2 = body.items.indexOf(created2);

    expect(created1.rate).toBe('190.5');
    expect(created2.rate).toBe('191');
    // effective_at desc: the later effectiveAt (create2) must sort before create1.
    expect(index2).toBeLessThan(index1);

    const patchAttempt = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/exchange-rates/${created2.id}`,
      headers: { cookie: cookieHeader },
      payload: { rate: '999' },
    });
    expect(patchAttempt.statusCode).toBe(404);
  });
});
