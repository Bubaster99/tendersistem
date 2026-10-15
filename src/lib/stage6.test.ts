// Этап 6: сотрудники (только админ), реестр подрядчиков, журнал действий.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("Сотрудники, реестр, журнал (настоящая база)", async () => {
  const { prisma } = await import("./db");
  const staff = await import("./staff");
  const companies = await import("./companies");
  const { readJournal } = await import("./journal");

  const uniq = `${Date.now()}`;
  type U = { id: string; email: string; role: "admin" | "buyer" | "contractor" };
  let admin: U, buyer: U, contractor: U;
  let companyId = "";
  let wt = "";

  beforeAll(async () => {
    admin = await prisma.user.create({ data: { email: `admin-${uniq}@s6.ru`, role: "admin" } });
    buyer = await prisma.user.create({ data: { email: `buyer-${uniq}@s6.ru`, role: "buyer" } });
    wt = (await prisma.workType.create({ data: { name: `Лифты-${uniq}` } })).id;
    const c = await prisma.company.create({
      data: { inn: `77${uniq.slice(-8)}`, name: `ООО «Реестр ${uniq}»`, workTypes: [wt], experience: JSON.stringify([{ name: "ЖК Тест", year: "2024", amount: "10 млн", workType: "Лифты" }]) },
    });
    companyId = c.id;
    contractor = await prisma.user.create({ data: { email: `c-${uniq}@s6.ru`, role: "contractor", companyId } });
    // КП с суммой — в реестре суммы появляться не должны.
    const project = await prisma.project.create({ data: { name: "ЖК Реестр", isPublished: true } });
    const t = await prisma.tender.create({ data: { title: `Лифты ${uniq}`, projectId: project.id, workTypeId: wt, status: "cancelled", publishedAt: new Date(), deadlineAt: new Date() } });
    await prisma.bid.create({
      data: { tenderId: t.id, companyId, fileKey: "x", fileName: "x.xlsx", fileSize: 1, totalWithVat: 8_765_432, durationDays: 10, advancePercent: 0 },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("сотрудников добавляет только админ; email подрядчика и дубли — нельзя", async () => {
    expect(await staff.addStaff(buyer, `new-${uniq}@s6.ru`, null, "buyer")).toHaveProperty("error");
    expect(await staff.addStaff(contractor, `new-${uniq}@s6.ru`, null, "buyer")).toHaveProperty("error");
    expect(await staff.addStaff(admin, contractor.email, null, "buyer")).toHaveProperty("error");
    expect(await staff.addStaff(admin, `new-${uniq}@s6.ru`, "Новиков", "boss")).toHaveProperty("error");
    expect(await staff.addStaff(admin, `New-${uniq}@S6.ru`, "Новиков", "buyer")).toEqual({ ok: true });
    expect(await staff.addStaff(admin, `new-${uniq}@s6.ru`, null, "buyer")).toHaveProperty("error");
    expect((await prisma.user.findUniqueOrThrow({ where: { email: `new-${uniq}@s6.ru` } })).role).toBe("buyer");
  });

  it("свою роль сменить и себя удалить нельзя — админ всегда остаётся", async () => {
    expect(await staff.setStaffRole(admin, admin.id, "buyer")).toHaveProperty("error");
    expect(await staff.removeStaff(admin, admin.id)).toHaveProperty("error");
    expect(await staff.setStaffRole(buyer, admin.id, "buyer")).toHaveProperty("error");
    expect(await staff.removeStaff(admin, contractor.id)).toHaveProperty("error"); // подрядчика через «Сотрудников» не удалить
    const n = await prisma.user.findUniqueOrThrow({ where: { email: `new-${uniq}@s6.ru` } });
    expect(await staff.setStaffRole(admin, n.id, "admin")).toEqual({ ok: true });
    expect(await staff.removeStaff(admin, n.id)).toEqual({ ok: true });
    expect(await prisma.user.findUnique({ where: { id: n.id } })).toBeNull();
  });

  it("реестр: поиск по ИНН и названию, фильтр по виду работ; сумм КП нет", async () => {
    const byInn = await companies.listCompanies({ q: `77${uniq.slice(-8)}` });
    expect(byInn.map((c) => c.id)).toEqual([companyId]);
    expect(byInn[0].tenders).toBe(1);
    expect((await companies.listCompanies({ q: `Реестр ${uniq}` })).map((c) => c.id)).toEqual([companyId]);
    expect((await companies.listCompanies({ workType: wt })).map((c) => c.id)).toEqual([companyId]);
    const card = await companies.getCompany(companyId);
    expect(card?.experienceItems[0].name).toBe("ЖК Тест");
    expect(card?.history).toHaveLength(1);
    const xlsx = await companies.companiesXlsx({ q: uniq });
    expect(xlsx.subarray(0, 2).toString("latin1")).toBe("PK");
    for (const data of [JSON.stringify(byInn), JSON.stringify(card)]) expect(data).not.toContain("8765432");
  });

  it("статус и рейтинг: только снабжение, рейтинг 1–5; изменение — в журнал", async () => {
    expect(await companies.updateCompany(contractor, companyId, { status: "checked", rating: 5 })).toHaveProperty("error");
    expect(await companies.updateCompany(buyer, companyId, { status: "checked", rating: 6 })).toHaveProperty("error");
    expect(await companies.updateCompany(buyer, companyId, { status: "unknown", rating: 3 })).toHaveProperty("error");
    expect(await companies.updateCompany(buyer, companyId, { status: "checked", rating: 4 })).toEqual({ ok: true });
    const c = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    expect([c.status, c.rating]).toEqual(["checked", 4]);
    expect((await companies.listCompanies({ status: "checked", rating: "4", q: uniq })).map((x) => x.id)).toEqual([companyId]);
    expect(await companies.listCompanies({ rating: "5", q: uniq })).toEqual([]);
  });

  it("журнал: фильтр по типу действия и поиску, подписи по-русски", async () => {
    const j = await readJournal({ group: "admin", q: uniq });
    const actions = j.rows.map((r) => r.action);
    expect(actions).toContain("Добавлен сотрудник");
    expect(actions).toContain("Изменён подрядчик");
    expect(actions).toContain("Удалён сотрудник");
    expect(j.rows.every((r) => !r.action.includes("."))).toBe(true);
    expect((await readJournal({ group: "login", q: uniq })).total).toBe(0);
  });
});
