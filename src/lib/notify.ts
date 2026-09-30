import "server-only";
// Кому и когда уходят письма (раздел 7 SPEC.md). Тексты — в src/lib/mail/templates.ts.
// Массовые рассылки (старт приёма, напоминания, «КП вскрыты») идут по расписанию — src/lib/scheduler.ts.
// Каждая рассылка сначала ставит отметку в базе («уже отправлено»), потом шлёт — так письмо не уйдёт дважды.
import { prisma } from "./db";
import { sendMailSafe } from "./mailer";
import { closeExpiredTenders } from "./bids";
import { visibleTenderWhere } from "./tenders";
import * as T from "./mail/templates";
import type { EmailContent } from "./mail/layout";

const REMINDER_BEFORE_MS = 2 * 24 * 60 * 60 * 1000; // за 2 дня до дедлайна

async function send(to: string[], mail: EmailContent): Promise<void> {
  for (const email of new Set(to)) await sendMailSafe({ to: email, ...mail });
}

async function tenderInfo(tenderId: string): Promise<T.TenderInfo | null> {
  const t = await prisma.tender.findUnique({
    where: { id: tenderId },
    select: { id: true, title: true, deadlineAt: true, project: { select: { name: true } }, workType: { select: { name: true } } },
  });
  return t && { id: t.id, title: t.title, deadlineAt: t.deadlineAt, projectName: t.project.name, workTypeName: t.workType.name };
}

/** Email-адреса пользователей компаний (заблокированным не пишем). */
async function companyEmails(companyIds: string[]): Promise<Map<string, string[]>> {
  const users = await prisma.user.findMany({
    where: { role: "contractor", companyId: { in: companyIds }, company: { status: { not: "blocked" } } },
    select: { email: true, companyId: true },
  });
  const map = new Map<string, string[]>();
  for (const u of users) map.set(u.companyId!, [...(map.get(u.companyId!) ?? []), u.email]);
  return map;
}

/** Все сотрудники: снабженцы и админы. */
async function allStaffEmails(): Promise<string[]> {
  const rows = await prisma.user.findMany({ where: { role: { in: ["buyer", "admin"] } }, select: { email: true } });
  return rows.map((r) => r.email);
}

/** Ответственный по тендеру (email контакта) + все админы. */
async function responsibleEmails(tenderId: string): Promise<string[]> {
  const [tender, admins] = await Promise.all([
    prisma.tender.findUnique({ where: { id: tenderId }, select: { contact: { select: { email: true } } } }),
    prisma.user.findMany({ where: { role: "admin" }, select: { email: true } }),
  ]);
  const list = admins.map((a) => a.email);
  const contact = tender?.contact?.email?.trim().toLowerCase();
  if (contact) list.unshift(contact);
  return list;
}

// ---------- Сразу после действия ----------

/** Новая компания зарегистрировалась — всем сотрудникам. */
export async function notifyNewCompany(companyId: string, email: string): Promise<void> {
  const c = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true, inn: true, city: true } });
  if (!c) return;
  await send(await allStaffEmails(), T.staffNewCompanyEmail({ ...c, email }));
}

/** КП подано или заменено: подтверждение компании + уведомление ответственному и админам (без суммы). */
export async function notifyBidSubmitted(companyId: string, tenderId: string, replaced: boolean): Promise<void> {
  const [t, bid, company, count] = await Promise.all([
    tenderInfo(tenderId),
    prisma.bid.findUnique({
      where: { tenderId_companyId_round: { tenderId, companyId, round: 1 } },
      select: { fileName: true, submittedAt: true, replacedAt: true }, // сумму не запрашиваем
    }),
    prisma.company.findUnique({ where: { id: companyId }, select: { name: true } }),
    prisma.bid.count({ where: { tenderId, isWithdrawn: false } }),
  ]);
  if (!t || !bid || !company) return;
  const emails = (await companyEmails([companyId])).get(companyId) ?? [];
  await send(emails, T.bidAcceptedEmail(t, { fileName: bid.fileName, at: bid.replacedAt ?? bid.submittedAt, replaced }));
  await send(await responsibleEmails(tenderId), T.staffNewBidEmail(t, { companyName: company.name, replaced, count }));
}

// ---------- По расписанию ----------

export type OpenRecipient = { companyId: string; reason: "subscription" | "watch" };

/**
 * Кому писать об открытии приёма КП: нажавшим «Сообщить о старте» + подписчикам на вид работ
 * (и на этот объект, если в подписке выбраны объекты). Каждой компании — одно письмо.
 */
export async function tenderOpenRecipients(tender: { id: string; workTypeId: string; projectId: string }): Promise<OpenRecipient[]> {
  const [watchers, subscribers] = await Promise.all([
    prisma.tenderWatch.findMany({ where: { tenderId: tender.id }, select: { companyId: true } }),
    prisma.subscription.findMany({
      where: {
        byEmail: true,
        workTypeIds: { has: tender.workTypeId },
        OR: [{ projectIds: { isEmpty: true } }, { projectIds: { has: tender.projectId } }],
      },
      select: { companyId: true },
    }),
  ]);
  const result = new Map<string, OpenRecipient>();
  for (const w of watchers) result.set(w.companyId, { companyId: w.companyId, reason: "watch" });
  for (const s of subscribers) if (!result.has(s.companyId)) result.set(s.companyId, { companyId: s.companyId, reason: "subscription" });
  return [...result.values()];
}

/** Рассылка «Открыт приём КП» по всем открытым тендерам, по которым её ещё не было. */
export async function sendTenderOpenedNotices(now: Date = new Date()): Promise<number> {
  const tenders = await prisma.tender.findMany({
    where: { ...visibleTenderWhere, status: "open", openNoticeAt: null, deadlineAt: { gt: now } },
    select: { id: true, workTypeId: true, projectId: true },
  });
  let sent = 0;
  for (const tender of tenders) {
    const claimed = await prisma.tender.updateMany({ where: { id: tender.id, openNoticeAt: null }, data: { openNoticeAt: now } });
    if (claimed.count !== 1) continue; // уже разослал другой процесс
    const t = await tenderInfo(tender.id);
    if (!t) continue;
    const recipients = await tenderOpenRecipients(tender);
    const emails = await companyEmails(recipients.map((r) => r.companyId));
    for (const r of recipients) {
      const to = emails.get(r.companyId) ?? [];
      await send(to, T.tenderOpenedEmail(t, r.reason));
      sent += to.length;
    }
  }
  return sent;
}

/** «Дедлайн прошёл — КП вскрыты»: ответственному и админам, один раз на тендер. */
export async function sendBidsOpenedNotices(now: Date = new Date()): Promise<number> {
  await closeExpiredTenders(now);
  const tenders = await prisma.tender.findMany({
    where: { status: { in: ["closed", "rebid", "awarded"] }, bidsOpenedNoticeAt: null, deadlineAt: { lte: now } },
    select: { id: true },
  });
  let sent = 0;
  for (const { id } of tenders) {
    const claimed = await prisma.tender.updateMany({ where: { id, bidsOpenedNoticeAt: null }, data: { bidsOpenedNoticeAt: now } });
    if (claimed.count !== 1) continue;
    const [t, count] = await Promise.all([tenderInfo(id), prisma.bid.count({ where: { tenderId: id, isWithdrawn: false } })]);
    if (!t) continue;
    await send(await responsibleEmails(id), T.staffBidsOpenedEmail(t, count));
    sent++;
  }
  return sent;
}

/** Кому напомнить: скачали документацию открытого тендера, до дедлайна ≤ 2 дней, КП не подали, ещё не напоминали. */
export async function reminderCandidates(now: Date = new Date()) {
  return prisma.documentDownload.findMany({
    where: {
      reminderSentAt: null,
      company: { status: { not: "blocked" } },
      tender: { ...visibleTenderWhere, status: "open", deadlineAt: { gt: now, lte: new Date(now.getTime() + REMINDER_BEFORE_MS) } },
    },
    select: { companyId: true, tenderId: true, company: { select: { bids: { where: { isWithdrawn: false }, select: { tenderId: true } } } } },
  }).then((rows) =>
    rows.filter((r) => !r.company.bids.some((b) => b.tenderId === r.tenderId)).map(({ companyId, tenderId }) => ({ companyId, tenderId })),
  );
}

export async function sendDeadlineReminders(now: Date = new Date()): Promise<number> {
  let sent = 0;
  for (const { companyId, tenderId } of await reminderCandidates(now)) {
    const claimed = await prisma.documentDownload.updateMany({
      where: { companyId, tenderId, reminderSentAt: null },
      data: { reminderSentAt: now },
    });
    if (claimed.count !== 1) continue;
    const t = await tenderInfo(tenderId);
    if (!t) continue;
    const to = (await companyEmails([companyId])).get(companyId) ?? [];
    await send(to, T.deadlineReminderEmail(t));
    sent += to.length;
  }
  return sent;
}

// ---------- Этап 5: переторжка и итоги (шаблоны готовы, подключаются к кнопкам на этапе 5) ----------

export async function notifyRebidInvite(tenderId: string, companyIds: string[], rebidDeadline: Date): Promise<void> {
  const t = await tenderInfo(tenderId);
  if (!t) return;
  const emails = await companyEmails(companyIds);
  for (const id of companyIds) await send(emails.get(id) ?? [], T.rebidInviteEmail(t, rebidDeadline));
}

/** Итоги всем участникам: победителю — запрос документов, остальным — «выбран другой участник». */
export async function notifyResults(tenderId: string, winnerCompanyId: string, documents: string[]): Promise<void> {
  const t = await tenderInfo(tenderId);
  if (!t) return;
  const [participants, tender] = await Promise.all([
    prisma.bid.findMany({ where: { tenderId, isWithdrawn: false }, select: { companyId: true }, distinct: ["companyId"] }),
    prisma.tender.findUnique({ where: { id: tenderId }, select: { contact: { select: { name: true, email: true, phone: true } } } }),
  ]);
  const ids = [...new Set([winnerCompanyId, ...participants.map((p) => p.companyId)])];
  const emails = await companyEmails(ids);
  for (const id of ids) {
    const mail = id === winnerCompanyId ? T.winnerEmail(t, documents, tender?.contact ?? null) : T.notSelectedEmail(t);
    await send(emails.get(id) ?? [], mail);
  }
}
