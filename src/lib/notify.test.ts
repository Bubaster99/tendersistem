// Письма раздела 7 SPEC.md: кому уходят рассылки, без дублей, без сумм КП.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { renderEmail } from "./mail/layout";
import * as T from "./mail/templates";
import { testOutbox } from "./mailer";

describe("Шаблоны писем", () => {
  const t: T.TenderInfo = { id: "t1", title: "Фасад <секции 1–3>", projectName: "ЖК «Север»", workTypeName: "Фасад", deadlineAt: new Date("2026-10-12T15:00:00Z") };

  it("экранируют HTML и содержат ссылку на тендер и текстовую версию", () => {
    const m = T.tenderOpenedEmail(t, "subscription");
    expect(m.html).toContain("Фасад &lt;секции 1–3&gt;");
    expect(m.html).not.toContain("<секции");
    expect(m.html).toContain("/tenders/t1");
    expect(m.text).toContain("/tenders/t1");
    expect(m.text).toContain("12 октября, 18:00 (мск)");
  });

  it("у каждого письма есть тема, HTML и текст", () => {
    const all = [
      T.loginCodeEmail("123456"),
      T.tenderOpenedEmail(t, "watch"),
      T.bidAcceptedEmail(t, { fileName: "КП.xlsx", at: new Date(), replaced: true }),
      T.deadlineReminderEmail(t),
      T.rebidInviteEmail(t, new Date()),
      T.winnerEmail(t, ["Устав", "Выписка из ЕГРЮЛ"], { name: "Иванов", email: "i@x.ru", phone: null }),
      T.notSelectedEmail(t),
      T.staffNewCompanyEmail({ name: "ООО «А»", inn: "7700000000", city: null, email: "a@a.ru" }),
      T.staffNewBidEmail(t, { companyName: "ООО «А»", replaced: false, count: 3 }),
      T.staffBidsOpenedEmail(t, 3),
    ];
    for (const m of all) {
      expect(m.subject.length).toBeGreaterThan(5);
      expect(m.html).toContain("<!DOCTYPE html>");
      expect(m.text.length).toBeGreaterThan(20);
    }
  });

  it("код входа виден и в HTML, и в тексте", () => {
    const m = T.loginCodeEmail("654321");
    expect(m.subject).toContain("654321");
    expect(m.html).toContain("654321");
    expect(m.text).toContain("654321");
  });

  it("ссылка-кнопка экранируется", () => {
    const m = renderEmail({ subject: "s", title: "t", blocks: [], button: { label: "x", url: 'http://a/"><script>' } });
    expect(m.html).not.toContain('"><script>');
  });
});

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("Кому уходят письма (настоящая база)", async () => {
  const { prisma } = await import("./db");
  const notify = await import("./notify");

  const uniq = `${Date.now()}`;
  const to = (subjectPart: string) => testOutbox.filter((m) => m.subject.includes(subjectPart)).map((m) => m.to).sort();

  let wt = "", otherWt = "", project = "", otherProject = "";
  const company: Record<string, string> = {};
  let n = 0;

  async function mkCompany(key: string, status: "new" | "blocked" = "new") {
    n++;
    const c = await prisma.company.create({ data: { inn: `55${uniq.slice(-6)}${String(n).padStart(2, "0")}`, name: `ООО «${key}»`, status } });
    await prisma.user.create({ data: { email: `${key}-${uniq}@test.ru`, role: "contractor", companyId: c.id } });
    company[key] = c.id;
    return c.id;
  }
  const email = (key: string) => `${key}-${uniq}@test.ru`;

  async function mkTender(title: string, data: Partial<{ status: "planned" | "open" | "closed"; deadlineAt: Date; projectId: string; workTypeId: string; contactId: string; publishedAt: Date | null }> = {}) {
    return prisma.tender.create({
      data: { title: `${title} ${uniq}`, projectId: project, workTypeId: wt, status: "open", publishedAt: new Date(), deadlineAt: new Date(Date.now() + 10 * 86400_000), ...data },
    });
  }

  beforeAll(async () => {
    wt = (await prisma.workType.create({ data: { name: `Кровля-${uniq}` } })).id;
    otherWt = (await prisma.workType.create({ data: { name: `Лифты-${uniq}` } })).id;
    project = (await prisma.project.create({ data: { name: "ЖК Рассылка", isPublished: true } })).id;
    otherProject = (await prisma.project.create({ data: { name: "ЖК Другой", isPublished: true } })).id;

    const sub = (id: string, data: { workTypeIds: string[]; projectIds?: string[]; byEmail?: boolean }) =>
      prisma.subscription.create({ data: { companyId: id, ...data } });
    await sub(await mkCompany("all-projects"), { workTypeIds: [wt, otherWt] });
    await sub(await mkCompany("this-project"), { workTypeIds: [wt], projectIds: [project] });
    await sub(await mkCompany("other-project"), { workTypeIds: [wt], projectIds: [otherProject] });
    await sub(await mkCompany("other-work"), { workTypeIds: [otherWt] });
    await sub(await mkCompany("email-off"), { workTypeIds: [wt], byEmail: false });
    await sub(await mkCompany("blocked", "blocked"), { workTypeIds: [wt] });
    await sub(await mkCompany("watch-and-sub"), { workTypeIds: [wt] });
    await mkCompany("watch-only");
    await mkCompany("nobody");
    await prisma.user.create({ data: { email: `boss-${uniq}@test.ru`, role: "admin" } });
    await prisma.user.create({ data: { email: `buyer-${uniq}@test.ru`, role: "buyer" } });
  });

  beforeEach(() => {
    testOutbox.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("открытие приёма: подписчики по виду работ и объекту + «Сообщить о старте», каждому одно письмо", async () => {
    const tender = await mkTender("Старт", { status: "planned" });
    for (const k of ["watch-and-sub", "watch-only", "blocked"]) await prisma.tenderWatch.create({ data: { companyId: company[k], tenderId: tender.id } });

    // Пока «Скоро» — писем нет.
    await notify.sendTenderOpenedNotices();
    expect(to(`Старт ${uniq}`)).toEqual([]);

    await prisma.tender.update({ where: { id: tender.id }, data: { status: "open" } });
    await notify.sendTenderOpenedNotices();
    expect(to(`Старт ${uniq}`)).toEqual([email("all-projects"), email("this-project"), email("watch-and-sub"), email("watch-only")].sort());

    // Нажавшему «Сообщить о старте» — текст про его просьбу.
    const watchMail = testOutbox.find((m) => m.to === email("watch-and-sub"))!;
    expect(watchMail.text).toContain("Вы просили сообщить о старте");

    // Повторный проход расписания — повторных писем нет.
    testOutbox.length = 0;
    await notify.sendTenderOpenedNotices();
    expect(to(`Старт ${uniq}`)).toEqual([]);
  });

  it("черновик и тендер на скрытом объекте не рассылаются", async () => {
    const hidden = (await prisma.project.create({ data: { name: "ЖК Скрытый", isPublished: false } })).id;
    await mkTender("Черновик", { publishedAt: null });
    await mkTender("Скрытый", { projectId: hidden });
    await notify.sendTenderOpenedNotices();
    expect(to(`Черновик ${uniq}`)).toEqual([]);
    expect(to(`Скрытый ${uniq}`)).toEqual([]);
  });

  it("напоминание за 2 дня: скачал и не подал — да; подал, не скачивал, далеко до дедлайна — нет; второй раз — нет", async () => {
    const soon = await mkTender("Скоро дедлайн", { deadlineAt: new Date(Date.now() + 36 * 3600_000) });
    const far = await mkTender("Далеко дедлайн", { deadlineAt: new Date(Date.now() + 5 * 86400_000) });
    const now = new Date();
    for (const k of ["all-projects", "this-project", "blocked"]) {
      await prisma.documentDownload.create({ data: { companyId: company[k], tenderId: soon.id } });
    }
    await prisma.documentDownload.create({ data: { companyId: company["other-work"], tenderId: far.id } });
    // «this-project» уже подал КП.
    await prisma.bid.create({
      data: { tenderId: soon.id, companyId: company["this-project"], fileKey: "x", fileName: "КП.xlsx", fileSize: 1, totalWithVat: 1, durationDays: 1, advancePercent: 0 },
    });

    await notify.sendDeadlineReminders(now);
    expect(to(`Скоро дедлайн ${uniq}`)).toEqual([email("all-projects")]);
    expect(to(`Далеко дедлайн ${uniq}`)).toEqual([]);

    testOutbox.length = 0;
    await notify.sendDeadlineReminders(new Date(now.getTime() + 60_000));
    expect(to(`Скоро дедлайн ${uniq}`)).toEqual([]);
  });

  it("новое КП: подтверждение компании, ответственному и админам — без суммы", async () => {
    const contact = await prisma.contact.create({ data: { name: "Ответственный", email: `resp-${uniq}@test.ru` } });
    const tender = await mkTender("Новое КП", { contactId: contact.id });
    await prisma.bid.create({
      data: { tenderId: tender.id, companyId: company["nobody"], fileKey: "x", fileName: "Наше КП.xlsx", fileSize: 1, totalWithVat: 7654321.5, durationDays: 90, advancePercent: 30 },
    });

    await notify.notifyBidSubmitted(company["nobody"], tender.id, false);
    expect(to("КП принято")).toEqual([email("nobody")]);
    const staff = to("Новое КП:");
    expect(staff).toContain(`resp-${uniq}@test.ru`);
    expect(staff).toContain(`boss-${uniq}@test.ru`);
    expect(staff).not.toContain(`buyer-${uniq}@test.ru`); // рядовому снабженцу — только если он ответственный
    const all = JSON.stringify(testOutbox);
    expect(all).not.toMatch(/7\s?654\s?321|7654321/);
  });

  it("дедлайн прошёл: тендер закрывается, ответственному и админам — «КП вскрыты», один раз", async () => {
    const tender = await mkTender("Вскрытие", { deadlineAt: new Date(Date.now() + 60_000) });
    await notify.sendBidsOpenedNotices();
    expect(to(`Вскрытие ${uniq}`)).toEqual([]); // до дедлайна — ничего

    const later = new Date(Date.now() + 2 * 60_000);
    await notify.sendBidsOpenedNotices(later);
    expect((await prisma.tender.findUniqueOrThrow({ where: { id: tender.id } })).status).toBe("closed");
    expect(to(`Вскрытие ${uniq}`)).toContain(`boss-${uniq}@test.ru`);

    testOutbox.length = 0;
    await notify.sendBidsOpenedNotices(new Date(later.getTime() + 60_000));
    expect(to(`Вскрытие ${uniq}`)).toEqual([]);
  });

  it("новая регистрация — всем сотрудникам", async () => {
    await notify.notifyNewCompany(company["nobody"], email("nobody"));
    const list = to("Новая регистрация");
    expect(list).toContain(`boss-${uniq}@test.ru`);
    expect(list).toContain(`buyer-${uniq}@test.ru`);
  });

  it("итоги (для этапа 5): победителю — запрос документов, остальным — «выбран другой участник»", async () => {
    const tender = await mkTender("Итоги");
    for (const k of ["all-projects", "watch-only"]) {
      await prisma.bid.create({
        data: { tenderId: tender.id, companyId: company[k], fileKey: "x", fileName: "КП.xlsx", fileSize: 1, totalWithVat: 1, durationDays: 1, advancePercent: 0 },
      });
    }
    await notify.notifyResults(tender.id, company["all-projects"], ["Устав"]);
    expect(to("ваше КП выбрано")).toEqual([email("all-projects")]);
    expect(testOutbox.find((m) => m.to === email("watch-only"))?.text).toContain("выбран другой участник");
  });
});
