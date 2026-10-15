import "server-only";
// Всё чтение и запись КП — только через этот файл. Правило раздела 6 SPEC.md:
// до дедлайна суммы и файлы КП не отдаются никому, кроме самой компании (вариант А).
// Снабжению и админу до дедлайна — только количество.
import { Prisma, type UserRole } from "@prisma/client";
import { prisma } from "./db";
import { writeAudit } from "./audit";
import { bidAccess, checkBidFile, checkBidInput, isSealed, roundDeadline, submitRound, type BidInput } from "./bid-rules";
import { removeFile, saveUpload } from "./storage";
import { isStaffRole } from "./access-rules";
import { visibleTenderWhere } from "./tenders";

export type Viewer = { id: string; email: string; role: UserRole; companyId: string | null };
type Clock = () => Date;
const systemClock: Clock = () => new Date();

const isContractor = (v: Viewer): v is Viewer & { companyId: string } => v.role === "contractor" && !!v.companyId;

/**
 * Автоматический перевод в closed: открытые тендеры с прошедшим дедлайном и переторжки с прошедшим сроком.
 * Вызывается в начале каждого запроса, где важен статус. Возвращает число закрытых.
 */
export async function closeExpiredTenders(now: Date = new Date()): Promise<number> {
  const expired = await prisma.tender.findMany({
    where: { OR: [{ status: "open", deadlineAt: { lte: now } }, { status: "rebid", rebidDeadlineAt: { lte: now } }] },
    select: { id: true, status: true },
  });
  let closed = 0;
  for (const t of expired) {
    // Условие на прежний статус — чтобы при одновременных запросах тендер закрылся и попал в журнал один раз.
    const res = await prisma.tender.updateMany({ where: { id: t.id, status: t.status }, data: { status: "closed" } });
    if (res.count === 1) {
      closed++;
      const why = t.status === "open" ? "срок приёма КП истёк" : "срок переторжки истёк";
      await writeAudit(null, "tender.status", "tender", t.id, `${t.status} → closed: ${why} (автоматически)`);
    }
  }
  return closed;
}

/** Приглашена ли компания на переторжку по тендеру. */
export async function isRebidInvited(companyId: string | null, tenderId: string): Promise<boolean> {
  if (!companyId) return false;
  return (await prisma.rebidInvite.count({ where: { tenderId, companyId } })) > 0;
}

// ---------- Подрядчик: своё КП ----------

const ownBidSelect = {
  id: true,
  tenderId: true,
  round: true,
  fileName: true,
  fileSize: true,
  totalWithVat: true,
  durationDays: true,
  advancePercent: true,
  comment: true,
  submittedAt: true,
  replacedAt: true,
  _count: { select: { versions: true } },
} satisfies Prisma.BidSelect;

/** КП своей компании по тендеру (вариант А: своё видно всегда). Чужие КП этой функцией не достать. */
export async function getOwnBid(viewer: Viewer, tenderId: string, round = 1) {
  if (!isContractor(viewer)) return null;
  const bid = await prisma.bid.findUnique({
    where: { tenderId_companyId_round: { tenderId, companyId: viewer.companyId, round } },
    select: { ...ownBidSelect, isWithdrawn: true },
  });
  return bid && !bid.isWithdrawn ? bid : null;
}

/** «Мои заявки»: все КП своей компании. */
export async function listOwnBids(viewer: Viewer) {
  if (!isContractor(viewer)) return [];
  return prisma.bid.findMany({
    where: { companyId: viewer.companyId, isWithdrawn: false },
    orderBy: { submittedAt: "desc" },
    select: {
      ...ownBidSelect,
      tender: {
        select: {
          id: true,
          title: true,
          status: true,
          deadlineAt: true,
          rebidDeadlineAt: true,
          winnerCompanyId: true,
          project: { select: { name: true } },
          workType: { select: { name: true } },
          rebidInvites: { where: { companyId: viewer.companyId }, select: { companyId: true } },
        },
      },
    },
  });
}

/** По каким тендерам компания подала КП — для метки «Вы подали КП» в списках. */
export async function ownBidTenderIds(viewer: Viewer): Promise<Set<string>> {
  if (!isContractor(viewer)) return new Set();
  const rows = await prisma.bid.findMany({ where: { companyId: viewer.companyId, isWithdrawn: false }, select: { tenderId: true } });
  return new Set(rows.map((r) => r.tenderId));
}

// ---------- Подача и замена КП ----------

class SubmitRejected extends Error {}

export type SubmitResult = { error: string } | { ok: true; replaced: boolean; round: 1 | 2 };

/**
 * Подать или заменить КП. Все проверки — здесь, на сервере:
 * только подрядчик, только открытый тендер, только до дедлайна (серверное время), только .xlsx до 20 МБ.
 * При замене прежняя версия уходит в историю (BidVersion), её файл сохраняется.
 */
export async function submitBid(
  viewer: Viewer,
  tenderId: string,
  input: BidInput,
  file: File | null,
  ip: string | null = null,
  clock: Clock = systemClock,
): Promise<SubmitResult> {
  if (!isContractor(viewer)) return { error: "Подавать КП могут только подрядчики" };

  const tender = await prisma.tender.findFirst({
    where: { id: tenderId, ...visibleTenderWhere },
    select: { id: true, status: true, deadlineAt: true, rebidDeadlineAt: true },
  });
  if (!tender) return { error: "Тендер не найден" };
  // Раунд определяет сервер: открытый приём — 1, переторжка — 2 (только приглашённым).
  const invited = await isRebidInvited(viewer.companyId, tenderId);
  const allowed = submitRound(tender, clock(), invited);
  if ("error" in allowed) return { error: allowed.error };
  const round = allowed.round;

  const badInput = checkBidInput(input);
  if (badInput) return { error: badInput };
  if (!file) return { error: "Прикрепите файл КП (.xlsx)" };
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  const badFile = checkBidFile(file.name, file.size, head);
  if (badFile) return { error: badFile };

  const fileKey = await saveUpload(file, `bids/${tenderId}`);
  const fileName = file.name.replace(/[\\/]/g, "_").slice(0, 200);
  const fields = {
    fileKey,
    fileName,
    fileSize: file.size,
    totalWithVat: new Prisma.Decimal(input.totalWithVat.toFixed(2)),
    durationDays: input.durationDays,
    advancePercent: new Prisma.Decimal(input.advancePercent.toFixed(2)),
    comment: input.comment,
  };

  let replaced = false;
  let bidId = "";
  try {
    await prisma.$transaction(async (tx) => {
      // Повторная проверка срока прямо перед записью: файл мог загружаться долго.
      const fresh = await tx.tender.findUnique({ where: { id: tenderId }, select: { status: true, deadlineAt: true, rebidDeadlineAt: true } });
      if (!fresh) throw new SubmitRejected("Тендер не найден");
      const again = submitRound(fresh, clock(), invited);
      if ("error" in again) throw new SubmitRejected(again.error);
      if (again.round !== round) throw new SubmitRejected("Статус тендера изменился. Обновите страницу");

      const key = { tenderId, companyId: viewer.companyId, round };
      const existing = await tx.bid.findUnique({ where: { tenderId_companyId_round: key } });
      const at = clock();
      if (existing) {
        replaced = true;
        bidId = existing.id;
        await tx.bidVersion.create({
          data: {
            bidId: existing.id,
            fileKey: existing.fileKey,
            fileName: existing.fileName,
            fileSize: existing.fileSize,
            totalWithVat: existing.totalWithVat,
            durationDays: existing.durationDays,
            advancePercent: existing.advancePercent,
            comment: existing.comment,
            submittedAt: existing.replacedAt ?? existing.submittedAt,
            replacedAt: at,
          },
        });
        await tx.bid.update({ where: { id: existing.id }, data: { ...fields, replacedAt: at, isWithdrawn: false } });
      } else {
        const created = await tx.bid.create({ data: { ...key, ...fields, submittedAt: at } });
        bidId = created.id;
      }
    });
  } catch (e) {
    await removeFile(fileKey);
    if (e instanceof SubmitRejected) return { error: e.message };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "КП уже отправляется из другой вкладки. Обновите страницу" };
    }
    throw e;
  }

  // В журнал — без суммы.
  await writeAudit(viewer, replaced ? "bid.replace" : "bid.submit", "bid", bidId, `Тендер ${tenderId}, раунд ${round}, файл «${fileName}»`, ip);
  return { ok: true, replaced, round };
}

// ---------- Снабжение ----------

/** Количество участников (КП основного раунда) по тендерам — единственное, что снабжение видит до дедлайна. */
export async function bidCounts(tenderIds: string[]): Promise<Map<string, number>> {
  if (tenderIds.length === 0) return new Map();
  const rows = await prisma.bid.groupBy({
    by: ["tenderId"],
    where: { tenderId: { in: tenderIds }, isWithdrawn: false, round: 1 },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.tenderId, r._count._all]));
}

export type StaffBid = {
  id: string;
  companyId: string;
  round: number;
  company: { name: string; inn: string; status: "new" | "checked" | "blocked"; rating: number | null; workedWithUs: boolean; invited: boolean };
  fileName: string;
  fileSize: number;
  totalWithVat: Prisma.Decimal;
  durationDays: number;
  advancePercent: Prisma.Decimal;
  comment: string | null;
  submittedAt: Date;
  replacedAt: Date | null;
  versions: number;
};

export type StaffBids =
  | { sealed: true; count: number; deadlineAt: Date | null }
  | {
      sealed: false;
      count: number;
      deadlineAt: Date | null;
      bids: StaffBid[]; // основной раунд, по возрастанию суммы
      // Переторжка: пока срок не прошёл — только количество, как и в основном раунде.
      round2: { sealed: true; count: number; deadlineAt: Date | null } | { sealed: false; count: number; deadlineAt: Date | null; bids: StaffBid[] } | null;
    };

const staffBidSelect = {
  id: true,
  companyId: true,
  round: true,
  fileName: true,
  fileSize: true,
  totalWithVat: true,
  durationDays: true,
  advancePercent: true,
  comment: true,
  submittedAt: true,
  replacedAt: true,
  company: { select: { name: true, inn: true, status: true, rating: true } },
  _count: { select: { versions: true } },
} satisfies Prisma.BidSelect;

/**
 * КП по тендеру для снабжения. До дедлайна раунда — только количество (суммы даже не запрашиваются из базы).
 * После — список; каждый просмотр пишется в журнал (action — для выгрузки в Excel своё название).
 */
export async function staffTenderBids(
  viewer: Viewer,
  tenderId: string,
  ip: string | null = null,
  now: Date = new Date(),
  action = "bid.view",
): Promise<StaffBids | null> {
  if (!isStaffRole(viewer.role)) return null;
  const tender = await prisma.tender.findUnique({
    where: { id: tenderId },
    select: { deadlineAt: true, rebidDeadlineAt: true, rebidInvites: { select: { companyId: true } } },
  });
  if (!tender) return null;
  const active = { tenderId, isWithdrawn: false };
  const count = await prisma.bid.count({ where: { ...active, round: 1 } });
  if (isSealed(tender.deadlineAt, now)) return { sealed: true, count, deadlineAt: tender.deadlineAt };

  const invited = new Set(tender.rebidInvites.map((i) => i.companyId));
  const round2Sealed = tender.rebidDeadlineAt !== null && isSealed(tender.rebidDeadlineAt, now);
  // Суммы раунда 2 до срока переторжки из базы не запрашиваем.
  const rows = await prisma.bid.findMany({
    where: { ...active, ...(round2Sealed || tender.rebidDeadlineAt === null ? { round: 1 } : {}) },
    orderBy: { totalWithVat: "asc" },
    select: staffBidSelect,
  });

  // «Работал с нами»: снабжение отметило компанию как проверенную или она уже выигрывала у нас тендер.
  const companyIds = [...new Set(rows.map((r) => r.companyId))];
  const winners = await prisma.tender.findMany({
    where: { winnerCompanyId: { in: companyIds }, id: { not: tenderId } },
    select: { winnerCompanyId: true },
  });
  const won = new Set(winners.map((w) => w.winnerCompanyId));

  if (rows.length > 0) {
    await prisma.auditLog.createMany({
      data: rows.map((b) => ({
        userId: viewer.id,
        userEmail: viewer.email,
        action,
        entity: "bid",
        entityId: b.id,
        details: `Тендер ${tenderId}, раунд ${b.round}`,
        ip,
      })),
    });
  }
  const view = (b: (typeof rows)[number]): StaffBid => {
    const { _count, company, ...rest } = b;
    return {
      ...rest,
      company: {
        ...company,
        workedWithUs: company.status === "checked" || won.has(b.companyId),
        invited: invited.has(b.companyId),
      },
      versions: _count.versions,
    };
  };

  let round2: Extract<StaffBids, { sealed: false }>["round2"] = null;
  if (tender.rebidDeadlineAt) {
    const count2 = await prisma.bid.count({ where: { ...active, round: 2 } });
    round2 = round2Sealed
      ? { sealed: true, count: count2, deadlineAt: tender.rebidDeadlineAt }
      : { sealed: false, count: count2, deadlineAt: tender.rebidDeadlineAt, bids: rows.filter((r) => r.round === 2).map(view) };
  }
  return {
    sealed: false,
    count,
    deadlineAt: tender.deadlineAt,
    bids: rows.filter((r) => r.round === 1).map(view),
    round2,
  };
}

// ---------- Скачивание файла КП ----------

/**
 * Файл КП для скачивания или null (нет прав / нет такого КП — отвечаем одинаково, чтобы не подсказывать).
 * Своё КП компания скачивает всегда; снабжение и админ — только после дедлайна. Каждое скачивание — в журнал.
 */
export async function bidFileForDownload(viewer: Viewer, bidId: string, ip: string | null = null, now: Date = new Date()) {
  const bid = await prisma.bid.findUnique({
    where: { id: bidId },
    select: {
      id: true,
      round: true,
      companyId: true,
      isWithdrawn: true,
      fileKey: true,
      fileName: true,
      fileSize: true,
      tender: { select: { id: true, deadlineAt: true, rebidDeadlineAt: true } },
    },
  });
  if (!bid || bid.isWithdrawn) return null;
  // КП переторжки запечатаны до срока переторжки, основные — до основного дедлайна.
  if (bidAccess(viewer, bid.companyId, roundDeadline(bid.tender, bid.round), now) === "denied") return null;
  await writeAudit(viewer, "bid.download", "bid", bid.id, `Тендер ${bid.tender.id}, файл «${bid.fileName}»`, ip);
  return { fileKey: bid.fileKey, fileName: bid.fileName, fileSize: bid.fileSize };
}

// ---------- «Сообщить о старте» ----------

export async function isWatching(viewer: Viewer, tenderId: string): Promise<boolean> {
  if (!isContractor(viewer)) return false;
  return (await prisma.tenderWatch.count({ where: { companyId: viewer.companyId, tenderId } })) > 0;
}

/** Включить/выключить «Сообщить о старте». Включить можно только для тендера «Скоро». */
export async function setWatch(viewer: Viewer, tenderId: string, on: boolean): Promise<string | null> {
  if (!isContractor(viewer)) return "Доступно только подрядчикам";
  const key = { companyId: viewer.companyId, tenderId };
  if (!on) {
    await prisma.tenderWatch.deleteMany({ where: key });
    return null;
  }
  const tender = await prisma.tender.findFirst({ where: { id: tenderId, ...visibleTenderWhere }, select: { status: true } });
  if (!tender) return "Тендер не найден";
  if (tender.status !== "planned") return "Приём КП по этому тендеру уже открыт";
  await prisma.tenderWatch.upsert({ where: { companyId_tenderId: key }, create: key, update: {} });
  return null;
}
