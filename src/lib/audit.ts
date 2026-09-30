import "server-only";
import { prisma } from "./db";

export type AuditActor = { id: string; email: string } | null;

/**
 * Запись в журнал действий. В details не пишем суммы КП — журнал может читать
 * снабжение, а суммы до дедлайна закрыты.
 */
export async function writeAudit(
  actor: AuditActor,
  action: string,
  entity: string | null,
  entityId: string | null,
  details: string | null = null,
  ip: string | null = null,
): Promise<void> {
  await prisma.auditLog.create({ data: { userId: actor?.id ?? null, userEmail: actor?.email ?? null, action, entity, entityId, details, ip } });
}
