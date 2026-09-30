import "server-only";
import { prisma } from "./db";
import {
  CODE_MAX_ATTEMPTS,
  CODE_MAX_PER_HOUR,
  CODE_RESEND_INTERVAL_MS,
  CODE_TTL_MS,
  codeMatches,
  generateCode,
  hashCode,
} from "./login-code";
import { sendMail } from "./mailer";

export type Fail = { ok: false; error: string };

/** Создаём и отправляем код на email — с ограничением частоты (раз в минуту, 5 в час). */
export async function issueLoginCode(email: string): Promise<{ ok: true } | Fail> {
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

/** Проверяем код. null — код верный (и уже погашен), иначе — текст ошибки. */
export async function consumeLoginCode(email: string, rawCode: string): Promise<Fail | null> {
  const code = String(rawCode ?? "").replace(/\D/g, "");
  if (code.length !== 6) return { ok: false, error: "Введите 6 цифр из письма" };

  const login = await prisma.loginCode.findFirst({
    where: { email, expiresAt: { gt: new Date() } },
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
  return null;
}
