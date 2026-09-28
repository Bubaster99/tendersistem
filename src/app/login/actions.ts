"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { findCompanyByInn, type CompanyInfo } from "@/lib/dadata";
import {
  CODE_MAX_ATTEMPTS,
  CODE_MAX_PER_HOUR,
  CODE_RESEND_INTERVAL_MS,
  CODE_TTL_MS,
  codeMatches,
  generateCode,
  hashCode,
} from "@/lib/login-code";
import { sendMail } from "@/lib/mailer";
import { createSession } from "@/lib/session";
import { isValidEmail, isValidInn, normalizeEmail, normalizeInn } from "@/lib/validation";

type Fail = { ok: false; error: string };

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

  // Ограничение частоты: не чаще раза в минуту и не больше 5 кодов в час на один email.
  const now = Date.now();
  const recent = await prisma.loginCode.findMany({
    where: { email, createdAt: { gt: new Date(now - 60 * 60 * 1000) } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (recent[0] && now - recent[0].createdAt.getTime() < CODE_RESEND_INTERVAL_MS) {
    const wait = Math.ceil((CODE_RESEND_INTERVAL_MS - (now - recent[0].createdAt.getTime())) / 1000);
    return { ok: false, error: `Код уже отправлен. Запросить новый можно через ${wait} сек.` };
  }
  if (recent.length >= CODE_MAX_PER_HOUR) {
    return { ok: false, error: "Слишком много запросов кода. Попробуйте через час" };
  }

  const code = generateCode();
  // Старые коды этого email больше не действуют.
  await prisma.$transaction([
    prisma.loginCode.updateMany({ where: { email, expiresAt: { gt: new Date(now) } }, data: { expiresAt: new Date(now) } }),
    prisma.loginCode.create({
      data: { email, codeHash: hashCode(email, code), expiresAt: new Date(now + CODE_TTL_MS) },
    }),
  ]);

  await sendMail({
    to: email,
    subject: `Код входа: ${code}`,
    text: `Ваш код для входа на тендерную площадку: ${code}\n\nКод действует 10 минут. Если вы не запрашивали код — просто проигнорируйте это письмо.`,
  });
  return { ok: true };
}

/** Шаг 2: проверяем код, при первом входе создаём компанию и пользователя. */
export async function verifyCode(input: { inn: string; email: string; code: string }): Promise<Fail> {
  const inn = normalizeInn(input.inn);
  const email = normalizeEmail(input.email);
  const code = String(input.code ?? "").replace(/\D/g, "");
  if (!isValidInn(inn) || !isValidEmail(email)) return { ok: false, error: "Начните вход заново" };
  if (code.length !== 6) return { ok: false, error: "Введите 6 цифр из письма" };

  const now = new Date();
  const login = await prisma.loginCode.findFirst({
    where: { email, expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
  });
  if (!login) return { ok: false, error: "Код устарел. Запросите новый" };

  // Сначала засчитываем попытку (атомарно), потом сравниваем — так лимит нельзя обойти параллельными запросами.
  const counted = await prisma.loginCode.updateMany({
    where: { id: login.id, attempts: { lt: CODE_MAX_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });
  if (counted.count === 0) return { ok: false, error: "Слишком много неверных попыток. Запросите новый код" };

  if (!codeMatches(email, code, login.codeHash)) {
    const left = CODE_MAX_ATTEMPTS - (login.attempts + 1);
    return {
      ok: false,
      error: left > 0 ? `Неверный код. Осталось попыток: ${left}` : "Слишком много неверных попыток. Запросите новый код",
    };
  }

  await prisma.loginCode.deleteMany({ where: { email } });

  const conflict = await checkPair(inn, email);
  if (conflict) return conflict;

  let company = await prisma.company.findUnique({ where: { inn } });
  if (!company) {
    const found = await lookupInn(inn);
    if (!found.ok) return found;
    company = await prisma.company.upsert({ where: { inn }, update: {}, create: found.company });
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: { consentPdAt: now },
    create: { email, role: "contractor", companyId: company.id, consentPdAt: now },
  });

  console.log(`[вход] ${email} (ИНН ${inn}) вошёл в ${now.toISOString()}`);
  await createSession(user.id);
  redirect("/objects");
}
