import type { CustomerStatus, PaymentMethod, Prisma, PrismaClient } from '@prisma/client';

export interface AdminOrderFilters {
  search?: string;
  customerStatus?: string;
  paymentMethod?: string;
  assignedOperatorId?: string;
  hasApiError?: boolean;
  hasRefundInProgress?: boolean;
  submittedFrom?: Date;
  submittedTo?: Date;
}

function buildAdminOrderWhere(filters: AdminOrderFilters): Prisma.AvocardOrderWhereInput {
  const where: Prisma.AvocardOrderWhereInput = {};
  const and: Prisma.AvocardOrderWhereInput[] = [];

  if (filters.search) {
    and.push({
      OR: [
        { order_no: { contains: filters.search, mode: 'insensitive' } },
        { customer: { email: { contains: filters.search, mode: 'insensitive' } } },
        { customer_memo: { contains: filters.search, mode: 'insensitive' } },
      ],
    });
  }

  if (filters.customerStatus) {
    and.push({ customer_status: filters.customerStatus as CustomerStatus });
  }

  if (filters.paymentMethod) {
    and.push({ payment_method: filters.paymentMethod as PaymentMethod });
  }

  if (filters.assignedOperatorId) {
    and.push({ assigned_operator_id: filters.assignedOperatorId });
  }

  if (filters.hasRefundInProgress) {
    and.push({ items: { some: { refund_status: { in: ['REQUESTED', 'PROCESSING'] } } } });
  }

  if (filters.submittedFrom || filters.submittedTo) {
    and.push({
      submitted_at: {
        gte: filters.submittedFrom,
        lte: filters.submittedTo,
      },
    });
  }

  if (and.length > 0) {
    where.AND = and;
  }

  return where;
}

export function findOwnOrders(prisma: PrismaClient, customerId: string, skip: number, take: number) {
  return Promise.all([
    prisma.avocardOrder.findMany({
      where: { customer_id: customerId, hidden_at: null },
      include: { items: true },
      orderBy: { created_at: 'desc' },
      skip,
      take,
    }),
    prisma.avocardOrder.count({ where: { customer_id: customerId, hidden_at: null } }),
  ]);
}

export function findOwnOrderById(prisma: PrismaClient, customerId: string, id: string) {
  return prisma.avocardOrder.findFirst({
    where: { id, customer_id: customerId },
    include: { items: true },
  });
}

function orderIdFromBusinessKey(businessKey: string): string | undefined {
  return businessKey.split(':')[0];
}

async function findFailedAttemptOrderIds(prisma: PrismaClient): Promise<string[]> {
  const failedAttempts = await prisma.integrationAttempt.findMany({
    where: { status: 'FAILED' },
    select: { business_key: true },
  });
  return [
    ...new Set(
      failedAttempts.map((a) => orderIdFromBusinessKey(a.business_key)).filter((id): id is string => Boolean(id)),
    ),
  ];
}

export interface OrderErrorSummary {
  provider: string;
  operation: string;
  count: number;
  lastOccurredAt: string;
}

/**
 * Latest-per-(order, provider, operation) FAILED IntegrationAttempt summary
 * for a set of orders, used to show an error badge/reason on the admin
 * order list without a per-row round trip (05_CUSTOMER_AND_ADMIN_UX.md §8
 * "오류 badge").
 */
export async function findErrorSummariesForOrders(
  prisma: PrismaClient,
  orderIds: string[],
): Promise<Map<string, OrderErrorSummary[]>> {
  if (orderIds.length === 0) {
    return new Map();
  }

  const failed = await prisma.integrationAttempt.findMany({
    where: {
      status: 'FAILED',
      OR: orderIds.map((id) => ({ business_key: { startsWith: `${id}:` } })),
    },
    orderBy: { updated_at: 'desc' },
  });

  const byOrder = new Map<string, Map<string, OrderErrorSummary>>();
  for (const attempt of failed) {
    const orderId = orderIdFromBusinessKey(attempt.business_key);
    if (!orderId) continue;

    const key = `${attempt.provider}:${attempt.operation}`;
    const existing = byOrder.get(orderId) ?? new Map<string, OrderErrorSummary>();
    const current = existing.get(key);
    if (current) {
      current.count += 1;
    } else {
      existing.set(key, {
        provider: attempt.provider,
        operation: attempt.operation,
        count: 1,
        lastOccurredAt: attempt.updated_at.toISOString(),
      });
    }
    byOrder.set(orderId, existing);
  }

  return new Map([...byOrder.entries()].map(([orderId, map]) => [orderId, [...map.values()]]));
}

export async function findAnyOrders(
  prisma: PrismaClient,
  skip: number,
  take: number,
  filters: AdminOrderFilters = {},
) {
  const where = buildAdminOrderWhere(filters);

  if (filters.hasApiError) {
    const orderIds = await findFailedAttemptOrderIds(prisma);
    where.id = { in: orderIds };
  }

  return Promise.all([
    prisma.avocardOrder.findMany({
      where,
      include: { items: true, customer: true },
      orderBy: { created_at: 'desc' },
      skip,
      take,
    }),
    prisma.avocardOrder.count({ where }),
  ]);
}

export function findAnyOrderById(prisma: PrismaClient, id: string) {
  return prisma.avocardOrder.findUnique({
    where: { id },
    include: { items: true, customer: true },
  });
}

export function findIntegrationAttemptsForOrder(prisma: PrismaClient, orderId: string) {
  return prisma.integrationAttempt.findMany({
    where: { business_key: { startsWith: `${orderId}:` } },
    orderBy: { created_at: 'asc' },
  });
}

export function findNotesForOrder(prisma: PrismaClient, orderId: string) {
  return prisma.orderNote.findMany({
    where: { order_id: orderId },
    orderBy: { created_at: 'asc' },
  });
}

export function createOrderNote(
  db: PrismaClient | Prisma.TransactionClient,
  orderId: string,
  body: string,
  createdBy: string,
) {
  return db.orderNote.create({
    data: { order_id: orderId, body, created_by: createdBy },
  });
}

export function findAuditLogForOrder(prisma: PrismaClient, orderId: string) {
  return prisma.auditLog.findMany({
    where: { entity_type: 'avocard_order', entity_id: orderId },
    orderBy: { created_at: 'asc' },
  });
}

export function listAdminUsers(prisma: PrismaClient) {
  return prisma.adminUser.findMany({
    where: { is_active: true },
    select: { id: true, email: true, display_name: true },
    orderBy: { display_name: 'asc' },
  });
}
