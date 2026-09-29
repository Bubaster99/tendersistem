"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { findCompanyByInn, type CompanyInfo } from "@/lib/dadata";
import { consumeLoginCode, issueLoginCode, type Fail } from "@/lib/login-flow";
import { createSession } from "@/lib/session";
import { isValidEmail, isValidInn, normalizeEmail, normalizeInn } from "@/lib/validation";

function supportEmail() {
  return process.env.SUPPORT_EMAIL || "support@example.ru";
}

/** Шаг 1: ищем компанию по ИНН (сначала у нас, затем в DaData). */
export async function lookupInn(rawInn: string): Promise<{ ok: true; company: CompanyInfo } | Fail> {
  const inn = normalizeInn(rawInn);
  if (!isValidInn(inn)) return { ok: false, error: "ИНН должен состоять из 10 или 12 цифр" };

  const existing = await prisma.company.findUnique({ where: { inn } });
  if (existing) {
    if (existing.status === "blocked") return { ok: false, error: `Доступ для компании закрыт. Обратитесь к ${supportEmail()}` };
    const { kpp, ogrn, name, address, city } = existing;
    return { ok: true, company: { inn, kpp, ogrn, name, address, city } };
  }

  try {
    const company = await findCompanyByInn(inn);
    if (!company) return { ok: false, error: "Компания с таким ИНН не найдена в ЕГРЮЛ/ЕГРИП" };
    return { ok: true, company };
  } catch (e) {
    console.error("DaData:", e);
    return { ok: false, error: "Не удалось проверить ИНН. Попробуйте ещё раз через минуту" };
  }
}

/** Проверяем, что пара ИНН + email допустима: 1 ИНН = 1 аккаунт, 1 email = 1 компания. */
async function checkPair(inn: string, email: string): Promise<Fail | null> {
  const [company, user] = await Promise.all([
    prisma.company.findUnique({ where: { inn }, include: { users: { select: { email: true } } } }),
    prisma.user.findUnique({ where: { email } }),
  ]);
  if (company?.status === "blocked") return { ok: false, error: `Доступ для компании закрыт. Обратитесь к ${supportEmail()}` };
  if (company && company.users.length > 0 && !company.users.some((u) => u.email === email)) {
    return { ok: false, error: `Компания уже зарегистрирована, обратитесь к ${supportEmail()}` };
  }
  if (user && (user.role !== "contractor" || user.companyId !== company?.id)) {
    return { ok: false, error: `Этот email уже привязан к другой компании. Обратитесь к ${supportEmail()}` };
  }
  return null;
}

/** Шаг 1 → 2: отправляем код на email. */
export async function requestCode(input: { inn: string; email: string; consent: boolean }): Promise<{ ok: true } | Fail> {
  const inn = normalizeInn(input.inn);
  const email = normalizeEmail(input.email);
  if (!isValidInn(inn)) return { ok: false, error: "ИНН должен состоять из 10 или 12 цифр" };
  if (!isValidEmail(email)) return { ok: false, error: "Проверьте email — похоже, в нём ошибка" };
  if (input.consent !== true) return { ok: false, error: "Нужно согласие на обработку персональных данных и с положением о тендерах" };

  const conflict = await checkPair(inn, email);
  if (conflict) return conflict;

  return issueLoginCode(email);
}

/** Шаг 2: проверяем код, при первом входе создаём компанию и пользователя. */
export async function verifyCode(input: { inn: string; email: string; code: string }): Promise<Fail> {
  const inn = normalizeInn(input.inn);
  const email = normalizeEmail(input.email);
  if (!isValidInn(inn) || !isValidEmail(email)) return { ok: false, error: "Начните вход заново" };

  const wrong = await consumeLoginCode(email, input.code);
  if (wrong) return wrong;

  const conflict = await checkPair(inn, email);
  if (conflict) return conflict;

  let company = await prisma.company.findUnique({ where: { inn } });
  if (!company) {
    const found = await lookupInn(inn);
    if (!found.ok) return found;
    company = await prisma.company.upsert({ where: { inn }, update: {}, create: found.company });
  }

  const now = new Date();
  const user = await prisma.user.upsert({
    where: { email },
    update: { consentPdAt: now },
    create: { email, role: "contractor", companyId: company.id, consentPdAt: now },
  });

  console.log(`[вход] ${email} (ИНН ${inn}) вошёл в ${now.toISOString()}`);
  await createSession(user.id);
  redirect("/objects");
}
