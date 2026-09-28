import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, DEV_CUSTOMER_HEADER } from './helpers/build-test-app.js';
import { createAdminSessionCookie } from './helpers/admin-session.js';

/**
 * Regression tests for 1-step admin order features:
 * - Search by order number, email, memo
 * - Filters: customer status, payment method, assigned operator, API error, refund, date range
 * - Assign operator & persistence after refresh
 * - Accumulate & time-order notes
 * - Audit log ASSIGN_OPERATOR & ADD_NOTE
 * - API error filtering
 * - Error badge & detail API response
 * - Permission checks (customers cannot access admin API)
 */

describe('admin orders (1-step features)', () => {
  let app: FastifyInstance;
  let adminCookieHeader: string;
  let adminId: string;

  beforeAll(async () => {
    app = await buildTestApp();
    const session = await createAdminSessionCookie(app);
    adminCookieHeader = session.cookieHeader;
    adminId = session.adminId;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('search functionality', () => {
    it('searches by order number (case-insensitive)', async () => {
      const customerId = `test-search-${randomUUID()}`;
      const order = await createTestOrder(app, customerId, 'Test Search Order');

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/orders?search=${order.orderNo}`,
        headers: { cookie: adminCookieHeader },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.items).toHaveLength(1);
      expect(body.items[0].orderNo).toBe(order.orderNo);
    });

    it('searches by customer email (case-insensitive)', async () => {
      const customerId = `test-email-${randomUUID()}`;
      const testEmail = `admin-test-${randomUUID()}@example.com`;

      // Create customer with email
      await app.prisma.customerProfile.create({
        data: {
          id: customerId,
          shopify_customer_id: customerId,
          email: testEmail,
        },
      });

      const order = await createTestOrder(app, customerId, 'Test');

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/orders?search=${testEmail.toUpperCase()}`,
        headers: { cookie: adminCookieHeader },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.items).toHaveLength(1);
      expect(body.items[0].id).toBe(order.id);
    });

    it('searches by customer memo (case-insensitive)', async () => {
      const customerId = `test-memo-${randomUUID()}`;
      const memo = `Special instruction for order`;
      const order = await createTestOrder(app, customerId, memo);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/orders?search=SPECIAL`,
        headers: { cookie: adminCookieHeader },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      const found = body.items.find((o: any) => o.id === order.id);
      expect(found).toBeDefined();
    });
  });

  describe('filter functionality', () => {
    it('filters by customer status', async () => {
      const customerId = `test-status-${randomUUID()}`;
      await createTestOrder(app, customerId, 'Test');

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/orders?customerStatus=QUOTE_PENDING',
        headers: { cookie: adminCookieHeader },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.items.every((o: any) => o.customerStatus === 'QUOTE_PENDING')).toBe(true);
    });

    it('filters by payment method', async () => {
      const customerId = `test-payment-${randomUUID()}`;
      const order = await createTestOrder(app, customerId, 'Test');

      // Update payment method
      await app.prisma.avocardOrder.update({
        where: { id: order.id },
        data: { payment_method: 'CARD' },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/orders?paymentMethod=CARD',
        headers: { cookie: adminCookieHeader },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      const found = body.items.find((o: any) => o.id === order.id);
      expect(found).toBeDefined();
      expect(found.paymentMethod).toBe('CARD');
    });

    it('filters by assigned operator', async () => {
      const customerId = `test-operator-${randomUUID()}`;
      const order = await createTestOrder(app, customerId, 'Test');

      // Assign to this test admin
      await app.prisma.avocardOrder.update({
        where: { id: order.id },
        data: { assigned_operator_id: adminId },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/orders?assignedOperatorId=${adminId}`,
        headers: { cookie: adminCookieHeader },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.items.some((o: any) => o.id === order.id)).toBe(true);
    });

    it('filters by API error status', async () => {
      const customerId = `test-error-${randomUUID()}`;
      const order = await createTestOrder(app, customerId, 'Test');

      // Record a failed integration attempt
      await app.prisma.integrationAttempt.create({
        data: {
          provider: 'ALIBABA_1688',
          operation: 'createCrossOrder',
          business_key: `${order.id}:seller1:1`,
          status: 'FAILED',
          response_sanitized: { message: 'Connection timeout' },
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/orders?hasApiError=true',
        headers: { cookie: adminCookieHeader },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      const found = body.items.find((o: any) => o.id === order.id);
      expect(found).toBeDefined();
      expect(found.errorSummaries).toHaveLength(1);
    });

    it('filters by refund in progress', async () => {
      const customerId = `test-refund-${randomUUID()}`;
      const order = await createTestOrder(app, customerId, 'Test');

      // Add an item with refund status
      const items = await app.prisma.orderItem.findMany({
        where: { order_id: order.id },
        take: 1,
      });

      if (items.length > 0) {
        await app.prisma.orderItem.update({
          where: { id: items[0].id },
          data: { refund_status: 'REQUESTED' },
        });

        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/admin/orders?hasRefundInProgress=true',
          headers: { cookie: adminCookieHeader },
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        const found = body.items.find((o: any) => o.id === order.id);
        expect(found).toBeDefined();
      }
    });

    it('filters by date range (submittedFrom and submittedTo)', async () => {
      const customerId = `test-date-${randomUUID()}`;
      const order = await createTestOrder(app, customerId, 'Test');

      const from = new Date(Date.now() - 1000000); // 1 second ago
      const to = new Date(Date.now() + 1000000); // 1 second in future

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/orders?submittedFrom=${from.toISOString()}&submittedTo=${to.toISOString()}`,
        headers: { cookie: adminCookieHeader },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      const found = body.items.find((o: any) => o.id === order.id);
      expect(found).toBeDefined();
    });
  });

  describe('operator assignment', () => {
    it('assigns operator to an order', async () => {
      const customerId = `test-assign-${randomUUID()}`;
      const order = await createTestOrder(app, customerId, 'Test');

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/orders/${order.id}/assigned-operator`,
        headers: { cookie: adminCookieHeader },
        payload: { operatorId: adminId },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.order.assignedOperatorId).toBe(adminId);
    });

    it('clears operator assignment when operatorId is null', async () => {
      const customerId = `test-clear-assign-${randomUUID()}`;
      const order = await createTestOrder(app, customerId, 'Test');

      // First assign
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/orders/${order.id}/assigned-operator`,
        headers: { cookie: adminCookieHeader },
        payload: { operatorId: adminId },
      });

      // Then clear
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/orders/${order.id}/assigned-operator`,
        headers: { cookie: adminCookieHeader },
        payload: { operatorId: null },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.order.assignedOperatorId).toBeNull();
    });

    it('persists assignment after refresh', async () => {
      const customerId = `test-persist-${randomUUID()}`;
      const order = await createTestOrder(app, customerId, 'Test');

      // Assign
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/orders/${order.id}/assigned-operator`,
        headers: { cookie: adminCookieHeader },
        payload: { operatorId: adminId },
      });

      // Fetch detail
      const detailResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/orders/${order.id}`,
        headers: { cookie: adminCookieHeader },
      });

      expect(detailResponse.statusCode).toBe(200);
      const body = detailResponse.json();
      expect(body.order.assignedOperatorId).toBe(adminId);
    });
  });

  describe('order notes', () => {
    it('adds a note to an order', async () => {
      const customerId = `test-notes-${randomUUID()}`;
      const order = await createTestOrder(app, customerId, 'Test');
      const noteBody = 'This is a test note';

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/orders/${order.id}/notes`,
        headers: { cookie: adminCookieHeader },
        payload: { body: noteBody },
      });

      expect(response.statusCode).toBe(201);
      const note = response.json();
      expect(note.body).toBe(noteBody);
      expect(note.createdBy).toBe(adminId);
    });

    it('accumulates multiple notes in time order', async () => {
      const customerId = `test-multi-notes-${randomUUID()}`;
      const order = await createTestOrder(app, customerId, 'Test');
      const noteTexts = ['First note', 'Second note', 'Third note'];

      // Add notes sequentially
      for (const text of noteTexts) {
        await app.inject({
          method: 'POST',
          url: `/api/v1/admin/orders/${order.id}/notes`,
          headers: { cookie: adminCookieHeader },
          payload: { body: text },
        });
      }

      // Fetch order detail
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/orders/${order.id}`,
        headers: { cookie: adminCookieHeader },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.notes).toHaveLength(3);
      expect(body.notes[0].body).toBe('First note');
      expect(body.notes[1].body).toBe('Second note');
      expect(body.notes[2].body).toBe('Third note');

      // Verify time ordering
      const t0 = new Date(body.notes[0].createdAt).getTime();
      const t1 = new Date(body.notes[1].createdAt).getTime();
      const t2 = new Date(body.notes[2].createdAt).getTime();
      expect(t0 <= t1 && t1 <= t2).toBe(true);
    });

    it('enforces note length limits', async () => {
      const customerId = `test-note-limit-${randomUUID()}`;
      const order = await createTestOrder(app, customerId, 'Test');
      const tooLongNote = 'a'.repeat(4001);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/orders/${order.id}/notes`,
        headers: { cookie: adminCookieHeader },
        payload: { body: tooLongNote },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('audit logging', () => {
    it('logs ASSIGN_OPERATOR action', async () => {
      const customerId = `test-audit-assign-${randomUUID()}`;
      const order = await createTestOrder(app, customerId, 'Test');

      await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/orders/${order.id}/assigned-operator`,
        headers: { cookie: adminCookieHeader },
        payload: { operatorId: adminId },
      });

      const auditRows = await app.prisma.auditLog.findMany({
        where: {
          entity_id: order.id,
          action: 'ASSIGN_OPERATOR',
        },
      });

      expect(auditRows.length).toBeGreaterThan(0);
      const assignLog = auditRows[0];
      expect(assignLog.actor_type).toBe('ADMIN');
      expect(assignLog.actor_id).toBe(adminId);
      expect(assignLog.after_json).toEqual({ assignedOperatorId: adminId });
    });

    it('logs ADD_NOTE action', async () => {
      const customerId = `test-audit-note-${randomUUID()}`;
      const order = await createTestOrder(app, customerId, 'Test');
      const noteBody = 'Test note for audit';

      await app.inject({
        method: 'POST',
        url: `/api/v1/admin/orders/${order.id}/notes`,
        headers: { cookie: adminCookieHeader },
        payload: { body: noteBody },
      });

      const auditRows = await app.prisma.auditLog.findMany({
        where: {
          entity_id: order.id,
          action: 'ADD_NOTE',
        },
      });

      expect(auditRows.length).toBeGreaterThan(0);
      const noteLog = auditRows[0];
      expect(noteLog.actor_type).toBe('ADMIN');
      expect(noteLog.actor_id).toBe(adminId);
      expect((noteLog.after_json as any).body).toBe(noteBody);
    });
  });

  describe('error badge and detail API', () => {
    it('includes error summaries in list response', async () => {
      const customerId = `test-error-badge-${randomUUID()}`;
      const order = await createTestOrder(app, customerId, 'Test');

      // Record multiple failed attempts
      await app.prisma.integrationAttempt.create({
        data: {
          provider: 'ALIBABA_1688',
          operation: 'createCrossOrder',
          business_key: `${order.id}:seller1:1`,
          status: 'FAILED',
          response_sanitized: { message: 'Error 1' },
        },
      });

      await app.prisma.integrationAttempt.create({
        data: {
          provider: 'ALIBABA_1688',
          operation: 'createCrossOrder',
          business_key: `${order.id}:seller1:2`,
          status: 'FAILED',
          response_sanitized: { message: 'Error 2' },
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/orders?hasApiError=true',
        headers: { cookie: adminCookieHeader },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      const found = body.items.find((o: any) => o.id === order.id);
      expect(found).toBeDefined();
      expect(found.errorSummaries).toHaveLength(1);
      expect(found.errorSummaries[0].provider).toBe('ALIBABA_1688');
      expect(found.errorSummaries[0].count).toBe(2);
      expect(found.errorSummaries[0].reason).toBe('1688 주문 생성 실패');
    });

    it('includes detailed integration attempts in detail response', async () => {
      const customerId = `test-error-detail-${randomUUID()}`;
      const order = await createTestOrder(app, customerId, 'Test');

      await app.prisma.integrationAttempt.create({
        data: {
          provider: 'ALIBABA_1688',
          operation: 'createCrossOrder',
          business_key: `${order.id}:seller1:1`,
          status: 'FAILED',
          response_sanitized: { message: 'Test error' },
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/orders/${order.id}`,
        headers: { cookie: adminCookieHeader },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.integrationAttempts).toHaveLength(1);
      expect(body.integrationAttempts[0].status).toBe('FAILED');
      expect(body.integrationAttempts[0].provider).toBe('ALIBABA_1688');
    });
  });

  describe('permission checks', () => {
    it('rejects customer access to admin list endpoint', async () => {
      const customerId = `test-customer-access-${randomUUID()}`;
      const customerHeader = { [DEV_CUSTOMER_HEADER]: customerId };

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/orders',
        headers: customerHeader,
      });

      expect(response.statusCode).toBe(401);
    });

    it('rejects customer access to admin detail endpoint', async () => {
      const customerId = `test-customer-detail-${randomUUID()}`;
      const order = await createTestOrder(app, customerId, 'Test');
      const customerHeader = { [DEV_CUSTOMER_HEADER]: customerId };

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/orders/${order.id}`,
        headers: customerHeader,
      });

      expect(response.statusCode).toBe(401);
    });

    it('rejects customer access to assign operator endpoint', async () => {
      const customerId = `test-customer-assign-${randomUUID()}`;
      const order = await createTestOrder(app, customerId, 'Test');
      const customerHeader = { [DEV_CUSTOMER_HEADER]: customerId };

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/orders/${order.id}/assigned-operator`,
        headers: customerHeader,
        payload: { operatorId: randomUUID() },
      });

      expect(response.statusCode).toBe(401);
    });

    it('rejects customer access to add note endpoint', async () => {
      const customerId = `test-customer-note-${randomUUID()}`;
      const order = await createTestOrder(app, customerId, 'Test');
      const customerHeader = { [DEV_CUSTOMER_HEADER]: customerId };

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/orders/${order.id}/notes`,
        headers: customerHeader,
        payload: { body: 'Unauthorized note' },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('operator list endpoint', () => {
    it('lists active admin operators', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/operators',
        headers: { cookie: adminCookieHeader },
      });

      expect(response.statusCode).toBe(200);
      const operators = response.json();
      expect(Array.isArray(operators)).toBe(true);
      expect(operators.length).toBeGreaterThan(0);
      expect(operators[0]).toHaveProperty('id');
      expect(operators[0]).toHaveProperty('email');
      expect(operators[0]).toHaveProperty('displayName');
    });
  });
});

// ============================================================================
// Test Helpers
// ============================================================================

async function createTestOrder(
  app: FastifyInstance,
  shopifyCustomerId: string,
  customerMemo?: string,
) {
  // Create customer profile
  await app.prisma.customerProfile.create({
    data: {
      shopify_customer_id: shopifyCustomerId,
      email: `customer-${shopifyCustomerId}@example.com`,
    },
  });

  // Submit order via customer API
  const submitResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/me/orders',
    headers: { [DEV_CUSTOMER_HEADER]: shopifyCustomerId },
    payload: {
      customsType: 'PERSONAL',
      transportMode: 'SEA',
      recipientSnapshot: { name: '홍길동', phone: '010-0000-0000' },
      customerMemo,
      items: [
        {
          offerId: `offer-${randomUUID()}`,
          sellerId: `seller-${randomUUID()}`,
          titleZh: '测试商品',
          qty: 1,
          cnyUnitPrice: '10.00',
        },
      ],
    },
  });

  if (submitResponse.statusCode !== 201) {
    throw new Error(`Failed to create test order: ${submitResponse.body}`);
  }

  return submitResponse.json();
}
