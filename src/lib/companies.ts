import "server-only";
// Реестр подрядчиков (раздел 5.5): поиск, фильтры, карточка, статус и рейтинг, экспорт в Excel.
// Суммы КП здесь не показываются — только факт участия и итог (правило запечатанных КП).
import ExcelJS from "exceljs";
import type { CompanyStatus, Prisma, UserRole } from "@prisma/client";
import { prisma } from "./db";
import { writeAudit } from "./audit";
import { isStaffRole } from "./access-rules";
import { STATUS_LABEL_ADMIN } from "./tenders";
import { formatDay } from "./time";

export const COMPANY_STATUS_LABEL: Record<CompanyStatus, string> = { new: "Новый", checked: "Проверен", blocked: "Заблокирован" };
const STATUSES = Object.keys(COMPANY_STATUS_LABEL) as CompanyStatus[];

export type CompanyFilter = { q?: string; workType?: string; status?: string; rating?: string };

export type ExperienceItem = { name: string; year: string; amount: string; workType: string };

export function parseExperience(raw: string | null): ExperienceItem[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((e) => e && typeof e.name === "string") : [];
  } catch {
    return [{ name: raw, year: "", amount: "", workType: "" }]; // старый формат — просто текст
  }
}

function whereOf(f: CompanyFilter): Prisma.CompanyWhereInput {
  const and: Prisma.CompanyWhereInput[] = [];
  const q = f.q?.trim().slice(0, 100);
  if (q) and.push({ OR: [{ name: { contains: q, mode: "insensitive" } }, { inn: { contains: q.replace(/\D/g, "") || q } }] });
  if (f.workType) and.push({ OR: [{ workTypes: { has: f.workType } }, { subscription: { workTypeIds: { has: f.workType } } }] });
  if (f.status && (STATUSES as string[]).includes(f.status)) and.push({ status: f.status as CompanyStatus });
  const r = Number(f.rating);
  if (Number.isInteger(r) && r >= 1 && r <= 5) and.push({ rating: { gte: r } });
  return and.length ? { AND: and } : {};
}

export async function listCompanies(f: CompanyFilter) {
  const [companies, workTypes] = await Promise.all([
    prisma.company.findMany({
      where: whereOf(f),
      orderBy: { createdAt: "desc" },
      take: 1000,
      select: {
        id: true,
        inn: true,
        name: true,
        city: true,
        region: true,
        status: true,
        rating: true,
        createdAt: true,
        workTypes: true,
        users: { select: { email: true } },
        subscription: { select: { workTypeIds: true } },
        bids: { where: { round: 1, isWithdrawn: false }, select: { tenderId: true } },
        _count: { select: { wonTenders: true } },
      },
    }),
    prisma.workType.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const wtName = new Map(workTypes.map((w) => [w.id, w.name]));
  return companies.map((c) => ({
    id: c.id,
    inn: c.inn,
    name: c.name,
    city: c.region || c.city,
    status: c.status,
    rating: c.rating,
    createdAt: c.createdAt,
    email: c.users.map((u) => u.email).join(", "),
    workTypes: [...new Set([...c.workTypes, ...(c.subscription?.workTypeIds ?? [])])].map((id) => wtName.get(id)).filter((n): n is string => !!n),
    tenders: new Set(c.bids.map((b) => b.tenderId)).size,
    wins: c._count.wonTenders,
  }));
}

export async function getCompany(id: string) {
  const c = await prisma.company.findUnique({
    where: { id },
    include: {
      users: { select: { email: true, createdAt: true, consentPdAt: true } },
      subscription: true,
      bids: {
        where: { isWithdrawn: false },
        orderBy: { submittedAt: "desc" },
        select: {
          round: true,
          submittedAt: true,
          tender: { select: { id: true, title: true, status: true, winnerCompanyId: true, project: { select: { name: true } } } },
        },
      },
    },
  });
  if (!c) return null;
  const workTypes = await prisma.workType.findMany({ select: { id: true, name: true } });
  const wtName = new Map(workTypes.map((w) => [w.id, w.name]));
  // История участия: по тендеру — одна строка (раунд 2 отмечаем).
  const history = new Map<string, { id: string; title: string; project: string; status: string; result: string; rebid: boolean; at: Date }>();
  for (const b of [...c.bids].reverse()) {
    const t = b.tender;
    const prev = history.get(t.id);
    const result = t.status === "awarded" ? (t.winnerCompanyId === c.id ? "Победитель" : "Не выбран") : STATUS_LABEL_ADMIN[t.status];
    history.set(t.id, { id: t.id, title: t.title, project: t.project.name, status: t.status, result, rebid: (prev?.rebid ?? false) || b.round === 2, at: prev?.at ?? b.submittedAt });
  }
  return {
    ...c,
    workTypeNames: c.workTypes.map((id) => wtName.get(id)).filter((n): n is string => !!n),
    subscriptionNames: (c.subscription?.workTypeIds ?? []).map((id) => wtName.get(id)).filter((n): n is string => !!n),
    experienceItems: parseExperience(c.experience),
    history: [...history.values()].sort((a, b) => b.at.getTime() - a.at.getTime()),
  };
}

/** Статус и рейтинг ставит снабжение. Заблокированная компания не может войти. */
export async function updateCompany(
  actor: { id: string; email: string; role: UserRole },
  id: string,
  input: { status: string; rating: number | null },
): Promise<{ error: string } | { ok: true }> {
  if (!isStaffRole(actor.role)) return { error: "Нет доступа" };
  if (!(STATUSES as string[]).includes(input.status)) return { error: "Выберите статус" };
  if (input.rating !== null && (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)) return { error: "Рейтинг — от 1 до 5" };
  const before = await prisma.company.findUnique({ where: { id }, select: { name: true, status: true, rating: true } });
  if (!before) return { error: "Компания не найдена" };
  await prisma.company.update({ where: { id }, data: { status: input.status as CompanyStatus, rating: input.rating } });
  const changes = [
    before.status !== input.status && `статус: ${COMPANY_STATUS_LABEL[before.status]} → ${COMPANY_STATUS_LABEL[input.status as CompanyStatus]}`,
    before.rating !== input.rating && `рейтинг: ${before.rating ?? "—"} → ${input.rating ?? "—"}`,
  ].filter(Boolean);
  if (changes.length) await writeAudit(actor, "company.update", "company", id, `${before.name}: ${changes.join(", ")}`);
  return { ok: true };
}

/** Реестр в Excel — с теми же фильтрами, что на экране. */
export async function companiesXlsx(f: CompanyFilter): Promise<Buffer> {
  const rows = await listCompanies(f);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Подрядчики");
  const header = ws.addRow(["Компания", "ИНН", "Город / регион", "Email", "Виды работ", "Статус", "Рейтинг", "Тендеров с КП", "Побед", "Зарегистрирован"]);
  header.font = { bold: true };
  for (const r of rows) {
    ws.addRow([r.name, r.inn, r.city ?? "", r.email, r.workTypes.join(", "), COMPANY_STATUS_LABEL[r.status], r.rating ?? "", r.tenders, r.wins, formatDay(r.createdAt)]);
  }
  [40, 14, 24, 30, 40, 14, 9, 14, 8, 18].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  ws.views = [{ state: "frozen", ySplit: 1 }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}
