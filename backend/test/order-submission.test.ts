import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, DEV_CUSTOMER_HEADER } from './helpers/build-test-app.js';

describe('order submission (1688 adapter is a stub in this slice)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('lands in ORDER_CREATE_PARTIAL_FAILURE because the stub 1688 adapter always throws, and logs the attempt + audit trail', async () => {
    const shopifyCustomerId = `test-order-${randomUUID()}`;

    const submitResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/me/orders',
      headers: { [DEV_CUSTOMER_HEADER]: shopifyCustomerId },
      payload: {
        customsType: 'PERSONAL',
        transportMode: 'SEA',
        recipientSnapshot: { name: '홍길동', phone: '010-0000-0000' },
        items: [
          {
            offerId: 'offer-1',
            sellerId: 'seller-1',
            titleZh: '测试商品',
            qty: 2,
            cnyUnitPrice: '10.50',
          },
        ],
      },
    });

    expect(submitResponse.statusCode).toBe(201);
    const customerDto = submitResponse.json();
    // Customer DTO must never leak internal fields.
    expect(customerDto).not.toHaveProperty('internalStatus');
    expect(customerDto).not.toHaveProperty('assignedOperatorId');
    expect(customerDto.customerStatus).toBe('QUOTE_PENDING');

    const { cookieHeader } = await (await import('./helpers/admin-session.js')).createAdminSessionCookie(app);

    const adminDetail = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/orders/${customerDto.id}`,
      headers: { cookie: cookieHeader },
    });
    expect(adminDetail.statusCode).toBe(200);
    const body = adminDetail.json();

    expect(body.order.internalStatus).toBe('ORDER_CREATE_PARTIAL_FAILURE');
    expect(body.integrationAttempts).toHaveLength(1);
    expect(body.integrationAttempts[0].provider).toBe('ALIBABA_1688');
    expect(body.integrationAttempts[0].status).toBe('FAILED');

    const auditRows = await app.prisma.auditLog.findMany({
      where: { entity_id: customerDto.id },
      orderBy: { created_at: 'asc' },
    });
    expect(auditRows.some((row) => row.action === 'SUBMIT')).toBe(true);
    expect(auditRows.some((row) => row.action === 'CREATE_1688_ORDERS_RESULT')).toBe(true);
  });
});
