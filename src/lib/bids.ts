import "server-only";
// Всё чтение и запись КП — только через этот файл. Правило раздела 6 SPEC.md:
// до дедлайна суммы и файлы КП не отдаются никому, кроме самой компании (вариант А).
// Снабжению и админу до дедлайна — только количество.
import { Prisma, type UserRole } from "@prisma/client";
import { prisma } from "./db";
import { writeAudit } from "./audit";
import { bidAccess, checkBidFile, checkBidInput, isSealed, submitBlocker, type BidInput } from "./bid-rules";
import { removeFile, saveUpload } from "./storage";
import { isStaffRole } from "./access-rules";
import { visibleTenderWhere } from "./tenders";

export type Viewer = { id: string; email: string; role: UserRole; companyId: string | null };
type Clock = () => Date;
const systemClock: Clock = () => new Date();

const isContractor = (v: Viewer): v is Viewer & { companyId: string } => v.role === "contractor" && !!v.companyId;

/**
 * Автоматический перевод в closed: все открытые тендеры с прошедшим дедлайном.
 * Вызывается в начале каждого запроса, где важен статус. Возвращает число закрытых.
 */
export async function closeExpiredTenders(now: Date = new Date()): Promise<number> {
  const expired = await prisma.tender.findMany({ where: { status: "open", deadlineAt: { lte: now } }, select: { id: true } });
  let closed = 0;
  for (const t of expired) {
    // Условие status: "open" — чтобы при одновременных запросах тендер закрылся и попал в журнал один раз.
    const res = await prisma.tender.updateMany({ where: { id: t.id, status: "open" }, data: { status: "closed" } });
    if (res.count === 1) {
      closed++;
      await writeAudit(null, "tender.status", "tender", t.id, "open → closed: срок приёма КП истёк (автоматически)");
    }
  }
  return closed;
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
      tender: { select: { id: true, title: true, status: true, deadlineAt: true, project: { select: { name: true } }, workType: { select: { name: true } } } },
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

export type SubmitResult = { error: string } | { ok: true; replaced: boolean };

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

  const tender = await prisma.tender.findFirst({ where: { id: tenderId, ...visibleTenderWhere }, select: { id: true, status: true, deadlineAt: true } });
  if (!tender) return { error: "Тендер не найден" };
  const blocked = submitBlocker(tender, clock());
  if (blocked) return { error: blocked };

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
      const fresh = await tx.tender.findUnique({ where: { id: tenderId }, select: { status: true, deadlineAt: true } });
      const late = fresh ? submitBlocker(fresh, clock()) : "Тендер не найден";
      if (late) throw new SubmitRejected(late);

      const key = { tenderId, companyId: viewer.companyId, round: 1 };
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
  await writeAudit(viewer, replaced ? "bid.replace" : "bid.submit", "bid", bidId, `Тендер ${tenderId}, файл «${fileName}»`, ip);
  return { ok: true, replaced };
}

// ---------- Снабжение ----------

/** Количество КП по тендерам — единственное, что снабжение видит до дедлайна. */
export async function bidCounts(tenderIds: string[]): Promise<Map<string, number>> {
  if (tenderIds.length === 0) return new Map();
  const rows = await prisma.bid.groupBy({ by: ["tenderId"], where: { tenderId: { in: tenderIds }, isWithdrawn: false }, _count: { _all: true } });
  return new Map(rows.map((r) => [r.tenderId, r._count._all]));
}

export type StaffBids =
  | { sealed: true; count: number; deadlineAt: Date | null }
  | {
      sealed: false;
      count: number;
      deadlineAt: Date | null;
      bids: {
        id: string;
        company: { name: string; inn: string };
        fileName: string;
        fileSize: number;
        totalWithVat: Prisma.Decimal;
        durationDays: number;
        advancePercent: Prisma.Decimal;
        comment: string | null;
        submittedAt: Date;
        replacedAt: Date | null;
        versions: number;
      }[];
    };

/**
 * КП по тендеру для снабжения. До дедлайна — только количество (суммы даже не запрашиваются из базы).
 * После — список; каждый просмотр пишется в журнал.
 */
export async function staffTenderBids(viewer: Viewer, tenderId: string, ip: string | null = null, now: Date = new Date()): Promise<StaffBids | null> {
  if (!isStaffRole(viewer.role)) return null;
  const tender = await prisma.tender.findUnique({ where: { id: tenderId }, select: { deadlineAt: true } });
  if (!tender) return null;
  const count = await prisma.bid.count({ where: { tenderId, isWithdrawn: false } });
  if (isSealed(tender.deadlineAt, now)) return { sealed: true, count, deadlineAt: tender.deadlineAt };

  const rows = await prisma.bid.findMany({
    where: { tenderId, isWithdrawn: false },
    orderBy: { totalWithVat: "asc" },
    select: {
      id: true,
      fileName: true,
      fileSize: true,
      totalWithVat: true,
      durationDays: true,
      advancePercent: true,
      comment: true,
      submittedAt: true,
      replacedAt: true,
      company: { select: { name: true, inn: true } },
      _count: { select: { versions: true } },
    },
  });
  if (rows.length > 0) {
    await prisma.auditLog.createMany({
      data: rows.map((b) => ({ userId: viewer.id, userEmail: viewer.email, action: "bid.view", entity: "bid", entityId: b.id, details: `Тендер ${tenderId}`, ip })),
    });
  }
  return {
    sealed: false,
    count,
    deadlineAt: tender.deadlineAt,
    bids: rows.map(({ _count, ...b }) => ({ ...b, versions: _count.versions })),
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
    select: { id: true, companyId: true, isWithdrawn: true, fileKey: true, fileName: true, fileSize: true, tender: { select: { id: true, deadlineAt: true } } },
  });
  if (!bid || bid.isWithdrawn) return null;
  if (bidAccess(viewer, bid.companyId, bid.tender.deadlineAt, now) === "denied") return null;
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
