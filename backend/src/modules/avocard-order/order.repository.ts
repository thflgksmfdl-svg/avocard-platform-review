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

export async function findAnyOrders(
  prisma: PrismaClient,
  skip: number,
  take: number,
  filters: AdminOrderFilters = {},
) {
  const where = buildAdminOrderWhere(filters);

  if (filters.hasApiError) {
    const failedAttempts = await prisma.integrationAttempt.findMany({
      where: { status: 'FAILED' },
      select: { business_key: true },
    });
    const orderIds = [
      ...new Set(
        failedAttempts
          .map((a) => a.business_key.split(':')[0])
          .filter((id): id is string => Boolean(id)),
      ),
    ];
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
