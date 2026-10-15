import "server-only";
// Переторжка и выбор победителя (разделы 5.3–5.4 SPEC.md). Все проверки — на сервере.
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { writeAudit } from "./audit";
import { closeExpiredTenders, type Viewer } from "./bids";
import { isStaffRole } from "./access-rules";
import { isSealed } from "./bid-rules";

type Result = { error: string } | { ok: true };

/** Бюджет тендера (видит только снабжение). null — очистить. */
export async function saveBudget(viewer: Viewer, tenderId: string, budget: number | null): Promise<Result> {
  if (!isStaffRole(viewer.role)) return { error: "Нет доступа" };
  if (budget !== null && (!Number.isFinite(budget) || budget <= 0 || budget >= 1e13)) return { error: "Бюджет — положительное число" };
  const res = await prisma.tender.updateMany({
    where: { id: tenderId },
    data: { budget: budget === null ? null : new Prisma.Decimal(budget.toFixed(2)) },
  });
  return res.count === 1 ? { ok: true } : { error: "Тендер не найден" };
}

/**
 * Переторжка с отмеченными: только после окончания основного приёма, один раз, только участникам основного раунда.
 * Тендер → «Переторжка», приглашённые могут подать КП раунда 2 до нового срока.
 */
export async function startRebid(viewer: Viewer, tenderId: string, companyIds: string[], deadline: Date | null, now: Date = new Date()): Promise<Result> {
  if (!isStaffRole(viewer.role)) return { error: "Нет доступа" };
  await closeExpiredTenders(now);
  const tender = await prisma.tender.findUnique({ where: { id: tenderId }, select: { status: true, deadlineAt: true, rebidDeadlineAt: true } });
  if (!tender) return { error: "Тендер не найден" };
  if (tender.status !== "closed" || isSealed(tender.deadlineAt, now)) return { error: "Переторжку можно начать только после окончания приёма КП" };
  if (tender.rebidDeadlineAt) return { error: "Переторжка по этому тендеру уже проводилась" };
  const ids = [...new Set(companyIds)];
  if (ids.length === 0) return { error: "Отметьте участников переторжки" };
  if (!deadline) return { error: "Укажите срок подачи КП на переторжку" };
  if (deadline <= now) return { error: "Срок переторжки уже прошёл — укажите время в будущем" };

  const participants = await prisma.bid.count({ where: { tenderId, round: 1, isWithdrawn: false, companyId: { in: ids } } });
  if (participants !== ids.length) return { error: "На переторжку можно пригласить только участников, подавших КП" };

  const started = await prisma.$transaction(async (tx) => {
    // Условие на статус — чтобы двойное нажатие не запустило переторжку дважды.
    const res = await tx.tender.updateMany({
      where: { id: tenderId, status: "closed", rebidDeadlineAt: null },
      data: { status: "rebid", rebidDeadlineAt: deadline, bidsOpenedNoticeAt: null },
    });
    if (res.count !== 1) return false;
    await tx.rebidInvite.createMany({ data: ids.map((companyId) => ({ tenderId, companyId })) });
    return true;
  });
  if (!started) return { error: "Переторжка по этому тендеру уже проводилась" };
  await writeAudit(viewer, "tender.status", "tender", tenderId, `closed → rebid: переторжка, приглашено ${ids.length}`);
  return { ok: true };
}

/** Выбор победителя: после окончания приёма (и переторжки, если была), из участников. Тендер → «Победитель выбран». */
export async function chooseWinner(viewer: Viewer, tenderId: string, companyId: string, now: Date = new Date()): Promise<Result> {
  if (!isStaffRole(viewer.role)) return { error: "Нет доступа" };
  await closeExpiredTenders(now);
  const tender = await prisma.tender.findUnique({ where: { id: tenderId }, select: { status: true, deadlineAt: true } });
  if (!tender) return { error: "Тендер не найден" };
  if (tender.status === "awarded") return { error: "Победитель уже выбран" };
  if (tender.status === "rebid") return { error: "Идёт переторжка — выбрать победителя можно после её окончания" };
  if (tender.status !== "closed" || isSealed(tender.deadlineAt, now)) return { error: "Победителя можно выбрать только после окончания приёма КП" };
  const bid = await prisma.bid.findFirst({ where: { tenderId, companyId, isWithdrawn: false }, select: { company: { select: { name: true } } } });
  if (!bid) return { error: "Выберите участника, подавшего КП" };

  const res = await prisma.tender.updateMany({
    where: { id: tenderId, status: "closed" },
    data: { status: "awarded", winnerCompanyId: companyId, awardedAt: now },
  });
  if (res.count !== 1) return { error: "Победитель уже выбран" };
  await writeAudit(viewer, "tender.winner", "tender", tenderId, `Победитель: ${bid.company.name} (${companyId})`);
  return { ok: true };
}
