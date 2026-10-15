// Этап 5: сравнение КП, переторжка (раунд 2), выбор победителя, итоги всем участникам.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { budgetDeltaPct, compareBids } from "./compare";
import { contractorStage, roundDeadline, submitRound } from "./bid-rules";
import { testOutbox } from "./mailer";

describe("Сравнение КП", () => {
  const bid = (companyId: string, total: number) => ({ companyId, totalWithVat: total });

  it("лучшая цена, отклонение от лучшей и разброс", () => {
    const c = compareBids([bid("A", 1_100_000), bid("B", 1_000_000), bid("C", 1_250_000)]);
    expect(c.rows.map((r) => r.companyId)).toEqual(["B", "A", "C"]);
    expect(c.best).toBe(1_000_000);
    expect(c.rows.map((r) => r.deviationPct)).toEqual([0, 10, 25]);
    expect(c.spreadPct).toBe(25);
  });

  it("итоговая цена — из переторжки, если она подана; иначе из основного раунда", () => {
    const c = compareBids([bid("A", 1_100_000), bid("B", 1_000_000)], [bid("A", 950_000)]);
    expect(c.rows[0].companyId).toBe("A");
    expect(c.rows[0].r1?.totalWithVat).toBe(1_100_000);
    expect(c.rows[0].r2?.totalWithVat).toBe(950_000);
    expect(c.best).toBe(950_000);
    expect(c.rows[1].r2).toBeNull();
  });

  it("пустой список и сравнение с бюджетом", () => {
    expect(compareBids([])).toEqual({ rows: [], best: null, worst: null, spreadPct: null });
    expect(budgetDeltaPct(900_000, 1_000_000)).toBe(-10);
    expect(budgetDeltaPct(900_000, null)).toBeNull();
  });
});

describe("Правила переторжки", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  const later = new Date("2026-10-22T12:00:00Z");
  const rebid = { status: "rebid", deadlineAt: new Date("2026-10-19T12:00:00Z"), rebidDeadlineAt: later };

  it("раунд 2 — только приглашённым и только до срока переторжки", () => {
    expect(submitRound(rebid, now, true)).toEqual({ round: 2 });
    expect(submitRound(rebid, now, false)).toHaveProperty("error");
    expect(submitRound(rebid, later, true)).toHaveProperty("error");
    expect(submitRound({ ...rebid, status: "open", deadlineAt: later }, now, false)).toEqual({ round: 1 });
    expect(submitRound({ ...rebid, status: "closed" }, now, true)).toHaveProperty("error");
  });

  it("КП раунда 2 запечатаны до срока переторжки", () => {
    expect(roundDeadline(rebid, 1)).toBe(rebid.deadlineAt);
    expect(roundDeadline(rebid, 2)).toBe(later);
  });

  it("«Мои заявки»: Переторжка → Итог", () => {
    const t = { status: "rebid", deadlineAt: rebid.deadlineAt, winnerCompanyId: null };
    expect(contractorStage(t, "A", true, now)).toBe("Переторжка");
    expect(contractorStage(t, "B", false, now)).toBe("Вскрыто");
    const done = { ...t, status: "awarded", winnerCompanyId: "A" };
    expect(contractorStage(done, "A", true, now)).toBe("Ваше КП выбрано");
    expect(contractorStage(done, "B", false, now)).toBe("Выбран другой участник");
  });
});

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("Переторжка и победитель (настоящая база)", async () => {
  const { prisma } = await import("./db");
  const bids = await import("./bids");
  const award = await import("./award");
  const notify = await import("./notify");
  const { buildSummaryXlsx } = await import("./summary-xlsx");
  const ExcelJS = (await import("exceljs")).default;

  type V = import("./bids").Viewer;
  const uniq = `${Date.now()}`;
  let buyer: V, admin: V;
  const user: Record<string, V> = {};
  let tenderId = "";
  let deadline: Date, t1: Date, rebidDeadline: Date, t2: Date;

  const REBID_SUM = 7_777_777; // сумма раунда 2 — до срока переторжки её не должно быть нигде
  const xlsx = () => {
    const buf = Buffer.alloc(1000, 0x20);
    buf.write("PK\x03\x04", 0, "latin1");
    return new File([buf], "КП.xlsx");
  };
  const input = (total: number) => ({ totalWithVat: total, durationDays: 60, advancePercent: 20, comment: null });
  const clock = (d: Date) => () => d;

  beforeAll(async () => {
    const project = await prisma.project.create({ data: { name: "ЖК Итоги", isPublished: true } });
    const wt = await prisma.workType.create({ data: { name: `Отделка-${uniq}` } });
    deadline = new Date(Date.now() + 86400_000);
    t1 = new Date(deadline.getTime() + 60_000); // после основного дедлайна
    rebidDeadline = new Date(t1.getTime() + 2 * 86400_000);
    t2 = new Date(rebidDeadline.getTime() + 60_000); // после переторжки
    tenderId = (
      await prisma.tender.create({
        data: { title: `Итоги ${uniq}`, projectId: project.id, workTypeId: wt.id, status: "open", deadlineAt: deadline, publishedAt: new Date(), openNoticeAt: new Date() },
      })
    ).id;
    let n = 0;
    for (const k of ["A", "B", "C", "D"]) {
      n++;
      const c = await prisma.company.create({ data: { inn: `66${uniq.slice(-6)}${n}0`, name: `ООО «${k}-${uniq}»` } });
      user[k] = await prisma.user.create({ data: { email: `${k.toLowerCase()}-${uniq}@award.ru`, role: "contractor", companyId: c.id } });
    }
    buyer = await prisma.user.create({ data: { email: `buyer-${uniq}@award.ru`, role: "buyer" } });
    admin = await prisma.user.create({ data: { email: `admin-${uniq}@award.ru`, role: "admin" } });

    expect(await bids.submitBid(user.A, tenderId, input(1_100_000), xlsx())).toMatchObject({ ok: true, round: 1 });
    expect(await bids.submitBid(user.B, tenderId, input(1_000_000), xlsx())).toMatchObject({ ok: true, round: 1 });
    expect(await bids.submitBid(user.C, tenderId, input(1_300_000), xlsx())).toMatchObject({ ok: true, round: 1 });
  });

  beforeEach(() => {
    testOutbox.length = 0;
  });

  afterAll(async () => {
    // Свои тендеры убираем из работы: другие тесты считают открытые тендеры в той же базе.
    await prisma.tender.updateMany({ where: { title: { endsWith: uniq } }, data: { status: "cancelled" } });
    await prisma.$disconnect();
  });

  it("переторжку нельзя начать до дедлайна, подрядчику, без участников и с прошедшим сроком", async () => {
    const soon = new Date(Date.now() + 2 * 86400_000);
    expect(await award.startRebid(buyer, tenderId, [user.A.companyId!], soon)).toHaveProperty("error");
    expect(await award.startRebid(user.A, tenderId, [user.A.companyId!], rebidDeadline, t1)).toHaveProperty("error");
    expect(await award.startRebid(buyer, tenderId, [], rebidDeadline, t1)).toHaveProperty("error");
    expect(await award.startRebid(buyer, tenderId, [user.A.companyId!], new Date(t1.getTime() - 1000), t1)).toHaveProperty("error");
    // D не подавал КП — пригласить нельзя.
    expect(await award.startRebid(buyer, tenderId, [user.A.companyId!, user.D.companyId!], rebidDeadline, t1)).toHaveProperty("error");
  });

  it("переторжка с отмеченными: тендер «Переторжка», приглашения в базе, повторно — нельзя", async () => {
    expect(await award.startRebid(buyer, tenderId, [user.A.companyId!, user.B.companyId!], rebidDeadline, t1)).toEqual({ ok: true });
    const t = await prisma.tender.findUniqueOrThrow({ where: { id: tenderId } });
    expect(t.status).toBe("rebid");
    expect(t.rebidDeadlineAt).toEqual(rebidDeadline);
    expect(await prisma.rebidInvite.count({ where: { tenderId } })).toBe(2);
    expect(await award.startRebid(buyer, tenderId, [user.C.companyId!], rebidDeadline, t1)).toHaveProperty("error");
    expect(await prisma.auditLog.count({ where: { entityId: tenderId, action: "tender.status", details: { contains: "rebid" } } })).toBe(1);
  });

  it("письма-приглашения уходят только приглашённым", async () => {
    await notify.notifyRebidInvite(tenderId, [user.A.companyId!, user.B.companyId!], rebidDeadline);
    expect(testOutbox.map((m) => m.to).sort()).toEqual([user.A.email, user.B.email].sort());
    expect(testOutbox[0].subject).toContain("Приглашение на переторжку");
  });

  it("раунд 2 подаёт только приглашённый и только до срока переторжки", async () => {
    const during = new Date(t1.getTime() + 3600_000);
    expect(await bids.submitBid(user.C, tenderId, input(900_000), xlsx(), null, clock(during))).toHaveProperty("error");
    expect(await bids.submitBid(user.D, tenderId, input(900_000), xlsx(), null, clock(during))).toHaveProperty("error");
    expect(await bids.submitBid(user.A, tenderId, input(REBID_SUM / 10), xlsx(), null, clock(during))).toEqual({ ok: true, replaced: false, round: 2 });
    // Замена КП переторжки — тоже раунд 2; КП раунда 1 не трогается.
    expect(await bids.submitBid(user.A, tenderId, input(REBID_SUM), xlsx(), null, clock(during))).toEqual({ ok: true, replaced: true, round: 2 });
    const r1 = await prisma.bid.findUniqueOrThrow({ where: { tenderId_companyId_round: { tenderId, companyId: user.A.companyId!, round: 1 } } });
    expect(Number(r1.totalWithVat)).toBe(1_100_000);
    expect(await bids.submitBid(user.B, tenderId, input(900_000), xlsx(), null, clock(t2))).toHaveProperty("error");
  });

  it("до срока переторжки КП раунда 2 запечатаны: ни сумм в списке, ни файла — даже админу", async () => {
    const during = new Date(t1.getTime() + 7200_000);
    for (const staff of [buyer, admin]) {
      const res = await bids.staffTenderBids(staff, tenderId, null, during);
      if (!res || res.sealed) throw new Error("ожидали вскрытый основной раунд");
      expect(res.bids).toHaveLength(3); // основной раунд виден
      expect(res.round2).toEqual({ sealed: true, count: 1, deadlineAt: rebidDeadline });
      expect(JSON.stringify(res)).not.toContain("7777777");
    }
    const r2 = await prisma.bid.findUniqueOrThrow({ where: { tenderId_companyId_round: { tenderId, companyId: user.A.companyId!, round: 2 } } });
    expect(await bids.bidFileForDownload(admin, r2.id, null, during)).toBeNull();
    expect(await bids.bidFileForDownload(buyer, r2.id, null, during)).toBeNull();
    expect(await bids.bidFileForDownload(user.B, r2.id, null, during)).toBeNull();
    expect(await bids.bidFileForDownload(user.A, r2.id, null, during)).not.toBeNull(); // своё — всегда
  });

  it("победителя нельзя выбрать во время переторжки", async () => {
    expect(await award.chooseWinner(admin, tenderId, user.A.companyId!, new Date(t1.getTime() + 3600_000))).toHaveProperty("error");
  });

  it("после срока переторжки: тендер «Приём закрыт», оба раунда видны, снабжению — «Переторжка завершена»", async () => {
    await notify.sendBidsOpenedNotices(t2);
    expect((await prisma.tender.findUniqueOrThrow({ where: { id: tenderId } })).status).toBe("closed");
    expect(testOutbox.some((m) => m.to === admin.email && m.subject.includes("Переторжка завершена"))).toBe(true);

    const res = await bids.staffTenderBids(buyer, tenderId, null, t2);
    if (!res || res.sealed || !res.round2 || res.round2.sealed) throw new Error("ожидали вскрытые оба раунда");
    expect(res.round2.bids.map((b) => Number(b.totalWithVat))).toEqual([REBID_SUM]);
    const r2 = res.round2.bids[0];
    expect(await bids.bidFileForDownload(buyer, r2.id, null, t2)).not.toBeNull();
    // Компания, приглашённая на переторжку, помечена.
    expect(res.bids.find((b) => b.companyId === user.A.companyId)?.company.invited).toBe(true);
    expect(res.bids.find((b) => b.companyId === user.C.companyId)?.company.invited).toBe(false);
  });

  it("сводная в Excel: оба раунда, все участники", async () => {
    const res = await bids.staffTenderBids(buyer, tenderId, null, t2, "bid.export");
    if (!res || res.sealed || !res.round2 || res.round2.sealed) throw new Error("ожидали вскрытые КП");
    const buf = await buildSummaryXlsx({
      title: "Итоги",
      projectName: "ЖК",
      workTypeName: "Отделка",
      deadlineAt: deadline,
      rebidDeadlineAt: rebidDeadline,
      budget: 1_200_000,
      round1: res.bids,
      round2: res.round2.bids,
      winnerCompanyId: null,
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as never);
    const text = JSON.stringify(wb.worksheets[0].getSheetValues());
    for (const k of ["A", "B", "C"]) expect(text).toContain(`ООО «${k}-${uniq}»`);
    expect(text).toContain("Сумма раунд 2");
    expect(text).toContain(String(REBID_SUM));
    expect(await prisma.auditLog.count({ where: { action: "bid.export", details: { contains: tenderId } } })).toBeGreaterThan(0);
  });

  it("выбор победителя: только администратор, только из участников, один раз; итоги — всем участникам", async () => {
    expect(await award.chooseWinner(user.A, tenderId, user.B.companyId!, t2)).toHaveProperty("error");
    expect(await award.chooseWinner(buyer, tenderId, user.B.companyId!, t2)).toHaveProperty("error"); // снабженцу — нельзя
    expect(await award.chooseWinner(admin, tenderId, user.D.companyId!, t2)).toHaveProperty("error");
    expect(await award.chooseWinner(admin, tenderId, user.B.companyId!, t2)).toEqual({ ok: true });
    expect(await award.chooseWinner(admin, tenderId, user.A.companyId!, t2)).toHaveProperty("error");
    const t = await prisma.tender.findUniqueOrThrow({ where: { id: tenderId } });
    expect(t.status).toBe("awarded");
    expect(t.winnerCompanyId).toBe(user.B.companyId);
    expect(await prisma.auditLog.count({ where: { entityId: tenderId, action: "tender.winner" } })).toBe(1);

    await notify.notifyResults(tenderId, user.B.companyId!, ["Устав", "Выписка из ЕГРЮЛ"]);
    const winnerMail = testOutbox.find((m) => m.to === user.B.email)!;
    expect(winnerMail.subject).toContain("ваше КП выбрано");
    expect(winnerMail.text).toContain("Выписка из ЕГРЮЛ");
    for (const k of ["A", "C"]) expect(testOutbox.find((m) => m.to === user[k].email)?.text).toContain("выбран другой участник");
    expect(testOutbox.some((m) => m.to === user.D.email)).toBe(false); // не участвовал — не пишем
  });

  it("«работал с нами»: компания, выигравшая другой тендер", async () => {
    const project = await prisma.project.findFirstOrThrow({ where: { name: "ЖК Итоги" } });
    const wt = await prisma.workType.findFirstOrThrow({ where: { name: `Отделка-${uniq}` } });
    const other = await prisma.tender.create({
      data: { title: `Другой ${uniq}`, projectId: project.id, workTypeId: wt.id, status: "closed", deadlineAt: new Date(Date.now() - 1000), publishedAt: new Date() },
    });
    for (const k of ["B", "C"]) {
      await prisma.bid.create({
        data: { tenderId: other.id, companyId: user[k].companyId!, fileKey: "x", fileName: "x.xlsx", fileSize: 1, totalWithVat: 1, durationDays: 1, advancePercent: 0 },
      });
    }
    const res = await bids.staffTenderBids(buyer, other.id);
    if (!res || res.sealed) throw new Error("ожидали вскрытые КП");
    expect(res.bids.find((b) => b.companyId === user.B.companyId)?.company.workedWithUs).toBe(true);
    expect(res.bids.find((b) => b.companyId === user.C.companyId)?.company.workedWithUs).toBe(false);
  });
});
