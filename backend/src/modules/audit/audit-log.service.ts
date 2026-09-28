import type { Prisma, PrismaClient } from '@prisma/client';
import type { RequestActor } from '../../shared/types.js';

export interface WriteAuditLogInput {
  entityType: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
  actor: RequestActor;
  correlationId?: string;
}

/**
 * Writes one audit_log row. Callers should invoke this inside the same
 * Prisma transaction as the mutation it describes (pass a transaction client
 * as `db`) so an audit record can never be silently lost if the mutation
 * commits. audit_log has no update/delete route anywhere in this codebase.
 */
export async function writeAuditLog(
  db: PrismaClient | Prisma.TransactionClient,
  input: WriteAuditLogInput,
): Promise<void> {
  await db.auditLog.create({
    data: {
      entity_type: input.entityType,
      entity_id: input.entityId,
      action: input.action,
      before_json: (input.before as Prisma.InputJsonValue) ?? undefined,
      after_json: (input.after as Prisma.InputJsonValue) ?? undefined,
      actor_type: input.actor.type,
      actor_id: input.actor.id,
      correlation_id: input.correlationId,
    },
  });
}
