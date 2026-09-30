// Главное правило безопасности (раздел 6 SPEC.md): запечатанные КП.
// До дедлайна сервер не отдаёт суммы и файлы КП никому, кроме самой компании (вариант А).
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { bidAccess, bidStage, checkBidFile, checkBidInput, isSealed, parseMoney, submitBlocker } from "./bid-rules";

const DEADLINE = new Date("2026-10-12T15:00:00Z"); // 12 октября, 18:00 мск
const BEFORE = new Date("2026-10-12T14:59:59Z");
const AFTER = new Date("2026-10-12T15:00:00Z");

describe("Правила: запечатанные КП", () => {
  const admin = { role: "admin" as const, companyId: null };
  const buyer = { role: "buyer" as const, companyId: null };
  const a = { role: "contractor" as const, companyId: "A" };
  const b = { role: "contractor" as const, companyId: "B" };

  it("до дедлайна КП запечатаны, ровно в момент дедлайна — вскрыты; без дедлайна — запечатаны", () => {
    expect(isSealed(DEADLINE, BEFORE)).toBe(true);
    expect(isSealed(DEADLINE, AFTER)).toBe(false);
    expect(isSealed(null, AFTER)).toBe(true);
  });

  it("до дедлайна КП не видит ни админ, ни снабженец, ни другой подрядчик", () => {
    expect(bidAccess(admin, "A", DEADLINE, BEFORE)).toBe("denied");
    expect(bidAccess(buyer, "A", DEADLINE, BEFORE)).toBe("denied");
    expect(bidAccess(b, "A", DEADLINE, BEFORE)).toBe("denied");
  });

  it("своё КП компания видит всегда", () => {
    expect(bidAccess(a, "A", DEADLINE, BEFORE)).toBe("own");
    expect(bidAccess(a, "A", DEADLINE, AFTER)).toBe("own");
  });

  it("после дедлайна КП видит снабжение и админ, но не другие подрядчики", () => {
    expect(bidAccess(admin, "A", DEADLINE, AFTER)).toBe("opened");
    expect(bidAccess(buyer, "A", DEADLINE, AFTER)).toBe("opened");
    expect(bidAccess(b, "A", DEADLINE, AFTER)).toBe("denied");
    expect(bidAccess({ role: "contractor", companyId: null }, "A", DEADLINE, AFTER)).toBe("denied");
  });

  it("подача: только открытый тендер и только до дедлайна", () => {
    expect(submitBlocker({ status: "open", deadlineAt: DEADLINE }, BEFORE)).toBeNull();
    expect(submitBlocker({ status: "open", deadlineAt: DEADLINE }, AFTER)).not.toBeNull();
    expect(submitBlocker({ status: "planned", deadlineAt: DEADLINE }, BEFORE)).not.toBeNull();
    expect(submitBlocker({ status: "closed", deadlineAt: DEADLINE }, BEFORE)).not.toBeNull();
  });

  it("«Мои заявки»: Подано до дедлайна, Вскрыто после", () => {
    expect(bidStage(DEADLINE, BEFORE)).toBe("Подано");
    expect(bidStage(DEADLINE, AFTER)).toBe("Вскрыто");
  });

  it("файл КП: только .xlsx до 20 МБ", () => {
    const pk = new Uint8Array([0x50, 0x4b, 3, 4]);
    expect(checkBidFile("КП.xlsx", 1000, pk)).toBeNull();
    expect(checkBidFile("КП.XLSX", 1000, pk)).toBeNull();
    expect(checkBidFile("КП.pdf", 1000, pk)).not.toBeNull();
    expect(checkBidFile("КП.xls", 1000, pk)).not.toBeNull();
    expect(checkBidFile("КП.xlsx", 20 * 1024 * 1024 + 1, pk)).not.toBeNull();
    expect(checkBidFile("КП.xlsx", 0, pk)).not.toBeNull();
    expect(checkBidFile("вирус.xlsx", 1000, new Uint8Array([0x4d, 0x5a, 0, 0]))).not.toBeNull();
  });

  it("поля КП и сумма «12 500 000,50»", () => {
    expect(parseMoney("12 500 000,50")).toBe(12500000.5);
    expect(parseMoney("12500000 ₽")).toBe(12500000);
    expect(parseMoney("abc")).toBeNaN();
    const ok = { totalWithVat: 1000, durationDays: 30, advancePercent: 10, comment: null };
    expect(checkBidInput(ok)).toBeNull();
    expect(checkBidInput({ ...ok, totalWithVat: 0 })).not.toBeNull();
    expect(checkBidInput({ ...ok, totalWithVat: 10.555 })).not.toBeNull();
    expect(checkBidInput({ ...ok, durationDays: 1.5 })).not.toBeNull();
    expect(checkBidInput({ ...ok, advancePercent: 101 })).not.toBeNull();
  });
});

// ---------- Проверка на настоящей базе: сервер, запросы, скачивание ----------

vi.mock("@/lib/session", () => ({ getCurrentUser: vi.fn() }));

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("Сервер и база: запечатанные КП", async () => {
  const { prisma } = await import("./db");
  const bids = await import("./bids");
  const { fileExists } = await import("./storage");
  const session = await import("@/lib/session");
  const route = await import("@/app/api/bids/[id]/file/route");
  const getCurrentUser = vi.mocked(session.getCurrentUser);

  type V = import("./bids").Viewer;
  let admin: V, buyer: V, userA: V, userB: V;
  let tenderId = "", plannedId = "", expiredId = "";
  let deadline: Date;

  const SECRET_SUM = 12345678.9; // эту сумму ищем во всех ответах
  const xlsx = (name = "КП.xlsx", size = 2000) => {
    const buf = Buffer.alloc(size, 0x20);
    buf.write("PK\x03\x04", 0, "latin1");
    return new File([buf], name);
  };
  const input = (total = SECRET_SUM) => ({ totalWithVat: total, durationDays: 90, advancePercent: 30, comment: "Материалы наши" });

  async function download(user: V | null, bidId: string) {
    getCurrentUser.mockResolvedValue(user as never);
    return route.GET(new Request(`http://localhost/api/bids/${bidId}/file`), { params: Promise.resolve({ id: bidId }) });
  }

  beforeAll(async () => {
    const project = await prisma.project.create({ data: { name: "ЖК Тест", isPublished: true } });
    const wt = await prisma.workType.create({ data: { name: `Фасад-${Date.now()}` } });
    deadline = new Date(Date.now() + 5 * 86400_000);
    const base = { projectId: project.id, workTypeId: wt.id, publishedAt: new Date() };
    tenderId = (await prisma.tender.create({ data: { ...base, title: "Фасад", status: "open", deadlineAt: deadline } })).id;
    plannedId = (await prisma.tender.create({ data: { ...base, title: "Кровля", status: "planned", plannedStart: "декабрь" } })).id;
    // Тендер, у которого дедлайн уже прошёл, но статус ещё open (никто не заходил на сайт).
    expiredId = (await prisma.tender.create({ data: { ...base, title: "Окна", status: "open", deadlineAt: new Date(Date.now() - 60_000) } })).id;

    const ca = await prisma.company.create({ data: { inn: "7700000001", name: "ООО «Альфа»" } });
    const cb = await prisma.company.create({ data: { inn: "7700000002", name: "ООО «Бета»" } });
    const mk = (email: string, role: "admin" | "buyer" | "contractor", companyId: string | null = null) =>
      prisma.user.create({ data: { email, role, companyId }, include: { company: true } });
    admin = await mk("admin@test.ru", "admin");
    buyer = await mk("buyer@test.ru", "buyer");
    userA = await mk("a@test.ru", "contractor", ca.id);
    userB = await mk("b@test.ru", "contractor", cb.id);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("подрядчики А и Б подают КП", async () => {
    expect(await bids.submitBid(userA, tenderId, input(), xlsx())).toEqual({ ok: true, replaced: false });
    expect(await bids.submitBid(userB, tenderId, input(9_000_000), xlsx("Бета.xlsx"))).toEqual({ ok: true, replaced: false });
  });

  it("до дедлайна админ и снабженец получают только количество — без сумм и файлов", async () => {
    for (const staff of [admin, buyer]) {
      const res = await bids.staffTenderBids(staff, tenderId);
      expect(res).toEqual({ sealed: true, count: 2, deadlineAt: deadline });
      const json = JSON.stringify(res);
      expect(json).not.toContain("12345678");
      expect(json).not.toContain("9000000");
      expect(json).not.toContain(".xlsx");
    }
    expect(await prisma.auditLog.count({ where: { action: "bid.view" } })).toBe(0);
  });

  it("до дедлайна API не отдаёт файл КП ни админу, ни снабженцу, ни чужому подрядчику, ни гостю", async () => {
    const bidA = await prisma.bid.findFirstOrThrow({ where: { tenderId, companyId: userA.companyId! } });
    expect((await download(admin, bidA.id)).status).toBe(404);
    expect((await download(buyer, bidA.id)).status).toBe(404);
    expect((await download(userB, bidA.id)).status).toBe(404);
    expect((await download(null, bidA.id)).status).toBe(401);
    expect(await bids.bidFileForDownload(admin, bidA.id)).toBeNull();
    expect(await bids.bidFileForDownload(buyer, bidA.id)).toBeNull();
    // Отказы в журнал «скачивание» не пишутся — скачивания не было.
    expect(await prisma.auditLog.count({ where: { action: "bid.download" } })).toBe(0);
  });

  it("свой файл подрядчик скачивает всегда (и это пишется в журнал)", async () => {
    const bidA = await prisma.bid.findFirstOrThrow({ where: { tenderId, companyId: userA.companyId! } });
    const res = await download(userA, bidA.id);
    expect(res.status).toBe(200);
    expect((await res.arrayBuffer()).byteLength).toBe(2000);
    expect(await prisma.auditLog.count({ where: { action: "bid.download", entityId: bidA.id, userId: userA.id } })).toBe(1);
  });

  it("подрядчик видит только своё КП — и в карточке тендера, и в «Моих заявках»", async () => {
    const own = await bids.getOwnBid(userB, tenderId);
    expect(Number(own?.totalWithVat)).toBe(9_000_000);
    const list = await bids.listOwnBids(userB);
    expect(list).toHaveLength(1);
    expect(JSON.stringify(list)).not.toContain("12345678");
    // Сотрудник через функции подрядчика ничего не получает.
    expect(await bids.getOwnBid(admin, tenderId)).toBeNull();
    expect(await bids.listOwnBids(buyer)).toEqual([]);
  });

  it("в журнал при подаче сумма не попадает", async () => {
    const logs = await prisma.auditLog.findMany({ where: { action: { in: ["bid.submit", "bid.replace"] } } });
    expect(logs.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(logs)).not.toContain("12345678");
  });

  it("замена КП: новые поля и файл, прежняя версия — в истории, её файл сохранён", async () => {
    const before = await prisma.bid.findFirstOrThrow({ where: { tenderId, companyId: userA.companyId! } });
    expect(await bids.submitBid(userA, tenderId, input(11_000_000), xlsx("КП v2.xlsx"))).toEqual({ ok: true, replaced: true });
    const after = await prisma.bid.findFirstOrThrow({ where: { id: before.id }, include: { versions: true } });
    expect(Number(after.totalWithVat)).toBe(11_000_000);
    expect(after.fileName).toBe("КП v2.xlsx");
    expect(after.replacedAt).not.toBeNull();
    expect(after.versions).toHaveLength(1);
    expect(Number(after.versions[0].totalWithVat)).toBe(SECRET_SUM);
    expect(await fileExists(after.versions[0].fileKey)).toBe(true);
    // Одна компания — одно КП на тендер.
    expect(await prisma.bid.count({ where: { tenderId, companyId: userA.companyId! } })).toBe(1);
  });

  it("сервер отклоняет: не xlsx, больше 20 МБ, тендер «Скоро», подачу от сотрудника", async () => {
    expect(await bids.submitBid(userB, tenderId, input(), new File([Buffer.from("%PDF-1.4")], "КП.pdf"))).toHaveProperty("error");
    expect(await bids.submitBid(userB, tenderId, input(), xlsx("big.xlsx", 20 * 1024 * 1024 + 1))).toHaveProperty("error");
    expect(await bids.submitBid(userB, tenderId, input(), new File([Buffer.from("MZ....")], "fake.xlsx"))).toHaveProperty("error");
    expect(await bids.submitBid(userB, plannedId, input(), xlsx())).toHaveProperty("error");
    expect(await bids.submitBid(admin, tenderId, input(), xlsx())).toHaveProperty("error");
  });

  it("после дедлайна подать или заменить КП нельзя (серверное время)", async () => {
    const late = () => new Date(deadline.getTime() + 1000);
    const res = await bids.submitBid(userA, tenderId, input(1), xlsx(), null, late);
    expect(res).toEqual({ error: "Приём КП завершён — срок подачи истёк" });
    const bid = await prisma.bid.findFirstOrThrow({ where: { tenderId, companyId: userA.companyId! } });
    expect(Number(bid.totalWithVat)).toBe(11_000_000);
  });

  it("тендер с прошедшим дедлайном сам переходит в closed, изменение статуса — в журнал", async () => {
    const closed = await bids.closeExpiredTenders();
    expect(closed).toBe(1);
    expect((await prisma.tender.findUniqueOrThrow({ where: { id: expiredId } })).status).toBe("closed");
    expect((await prisma.tender.findUniqueOrThrow({ where: { id: tenderId } })).status).toBe("open");
    expect(await prisma.auditLog.count({ where: { action: "tender.status", entityId: expiredId } })).toBe(1);
    // Повторный вызов ничего не меняет.
    expect(await bids.closeExpiredTenders()).toBe(0);
  });

  it("после дедлайна снабжение видит всё; каждый просмотр и скачивание — в журнале", async () => {
    const now = new Date(deadline.getTime() + 1000);
    expect(await bids.closeExpiredTenders(now)).toBe(1);
    const res = await bids.staffTenderBids(buyer, tenderId, "10.0.0.1", now);
    expect(res?.sealed).toBe(false);
    if (!res || res.sealed) throw new Error("ожидали вскрытые КП");
    expect(res.bids.map((b) => [b.company.name, Number(b.totalWithVat), b.durationDays, Number(b.advancePercent)])).toEqual([
      ["ООО «Бета»", 9_000_000, 90, 30],
      ["ООО «Альфа»", 11_000_000, 90, 30],
    ]);
    expect(await prisma.auditLog.count({ where: { action: "bid.view", userId: buyer.id, ip: "10.0.0.1" } })).toBe(2);

    const bidA = res.bids.find((b) => b.company.name === "ООО «Альфа»")!;
    expect(await bids.bidFileForDownload(admin, bidA.id, null, now)).toMatchObject({ fileName: "КП v2.xlsx" });
    expect(await prisma.auditLog.count({ where: { action: "bid.download", entityId: bidA.id, userId: admin.id } })).toBe(1);
    // Чужой подрядчик не видит КП и после дедлайна.
    expect(await bids.bidFileForDownload(userB, bidA.id, null, now)).toBeNull();
  });

  it("после дедлайна API отдаёт файл снабжению", async () => {
    const bid = await prisma.bid.create({
      data: { tenderId: expiredId, companyId: userB.companyId!, fileKey: "bids/none.xlsx", fileName: "x.xlsx", fileSize: 1, totalWithVat: 1, durationDays: 1, advancePercent: 0 },
    });
    // Файла на диске нет — но проверка прав пройдена (404 «Файл не найден на сервере», а не «Не найдено»).
    const res = await download(buyer, bid.id);
    expect(await res.text()).toBe("Файл не найден на сервере");
    expect((await download(userA, bid.id)).status).toBe(404);
    expect(await (await download(userA, bid.id)).text()).toBe("Не найдено");
  });

  it("«Сообщить о старте»: только для тендера «Скоро»", async () => {
    expect(await bids.setWatch(userA, plannedId, true)).toBeNull();
    expect(await bids.isWatching(userA, plannedId)).toBe(true);
    expect(await bids.setWatch(userA, plannedId, false)).toBeNull();
    expect(await bids.isWatching(userA, plannedId)).toBe(false);
    expect(await bids.setWatch(userA, tenderId, true)).not.toBeNull();
    expect(await bids.setWatch(admin, plannedId, true)).not.toBeNull();
  });
});
