import "server-only";
// Журнал действий (AuditLog) для администратора: фильтры по типу, email и датам.
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

export const ACTION_LABEL: Record<string, string> = {
  login: "Вход подрядчика",
  "login.staff": "Вход в админку",
  "bid.submit": "Подача КП",
  "bid.replace": "Замена КП",
  "bid.view": "Просмотр КП",
  "bid.download": "Скачивание файла КП",
  "bid.export": "Выгрузка сводной в Excel",
  "tender.status": "Статус тендера",
  "tender.winner": "Выбор победителя",
  "staff.add": "Добавлен сотрудник",
  "staff.role": "Изменена роль сотрудника",
  "staff.remove": "Удалён сотрудник",
  "company.update": "Изменён подрядчик",
};

export const ACTION_GROUPS: { key: string; label: string; actions: string[] }[] = [
  { key: "login", label: "Входы", actions: ["login", "login.staff"] },
  { key: "bids", label: "Подача КП", actions: ["bid.submit", "bid.replace"] },
  { key: "opened", label: "Просмотр и скачивание КП", actions: ["bid.view", "bid.download", "bid.export"] },
  { key: "tender", label: "Статусы и победители", actions: ["tender.status", "tender.winner"] },
  { key: "admin", label: "Сотрудники и подрядчики", actions: ["staff.add", "staff.role", "staff.remove", "company.update"] },
];

export const JOURNAL_PAGE_SIZE = 100;

/** «2026-10-15» → начало дня по Москве. */
const mskDay = (v: string | undefined, endOfDay = false): Date | null => {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00+03:00`);
  if (Number.isNaN(d.getTime())) return null;
  return endOfDay ? new Date(d.getTime() + 86400_000) : d;
};

export async function readJournal(f: { group?: string; q?: string; from?: string; to?: string; page?: number }) {
  const where: Prisma.AuditLogWhereInput = {};
  const group = ACTION_GROUPS.find((g) => g.key === f.group);
  if (group) where.action = { in: group.actions };
  const q = f.q?.trim().slice(0, 100);
  if (q) where.OR = [{ userEmail: { contains: q, mode: "insensitive" } }, { details: { contains: q, mode: "insensitive" } }];
  const from = mskDay(f.from);
  const to = mskDay(f.to, true);
  if (from || to) where.at = { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) };
  const page = Math.max(1, Math.min(f.page ?? 1, 10_000));

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { at: "desc" }, skip: (page - 1) * JOURNAL_PAGE_SIZE, take: JOURNAL_PAGE_SIZE }),
    prisma.auditLog.count({ where }),
  ]);

  // Ссылки на тендеры: для записей о КП тендер берём из самого КП.
  const bidIds = rows.filter((r) => r.entity === "bid" && r.entityId).map((r) => r.entityId!);
  const bids = bidIds.length ? await prisma.bid.findMany({ where: { id: { in: bidIds } }, select: { id: true, tenderId: true } }) : [];
  const bidTender = new Map(bids.map((b) => [b.id, b.tenderId]));
  const tenderIds = [...new Set([...rows.filter((r) => r.entity === "tender" && r.entityId).map((r) => r.entityId!), ...bids.map((b) => b.tenderId)])];
  const tenders = tenderIds.length ? await prisma.tender.findMany({ where: { id: { in: tenderIds } }, select: { id: true, title: true } }) : [];
  const tenderTitle = new Map(tenders.map((t) => [t.id, t.title]));

  return {
    total,
    page,
    pages: Math.max(1, Math.ceil(total / JOURNAL_PAGE_SIZE)),
    rows: rows.map((r) => {
      const tenderId = r.entity === "tender" ? r.entityId : r.entity === "bid" && r.entityId ? (bidTender.get(r.entityId) ?? null) : null;
      return {
        id: r.id,
        at: r.at,
        who: r.userEmail ?? "система",
        action: ACTION_LABEL[r.action] ?? r.action,
        details: r.details,
        ip: r.ip,
        tender: tenderId && tenderTitle.has(tenderId) ? { id: tenderId, title: tenderTitle.get(tenderId)! } : null,
      };
    }),
  };
}
