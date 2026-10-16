"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isStaffRole } from "@/lib/access";
import { consumeLoginCode, issueLoginCode, type Fail } from "@/lib/login-flow";
import { createSession, destroySession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { clientIp } from "@/lib/request-ip";
import { allow, HOUR, TOO_MANY } from "@/lib/rate-limit";
import { isValidEmail, normalizeEmail } from "@/lib/validation";

async function findStaff(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  return user && isStaffRole(user.role) ? user : null;
}

/** Вход сотрудника: только email, без ИНН. Код получают только сотрудники (buyer/admin). */
export async function requestStaffCode(rawEmail: string): Promise<{ ok: true } | Fail> {
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) return { ok: false, error: "Проверьте email — похоже, в нём ошибка" };
  if (!allow(`staff-code:${await clientIp()}`, 20, HOUR)) return { ok: false, error: TOO_MANY };
  // Не подсказываем постороннему, чей email есть среди сотрудников: ответ одинаковый, письмо — только сотруднику.
  if (!(await findStaff(email))) return { ok: true };
  const res = await issueLoginCode(email);
  return res.ok ? res : { ok: true };
}

export async function verifyStaffCode(input: { email: string; code: string }): Promise<Fail> {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) return { ok: false, error: "Начните вход заново" };
  const wrong = await consumeLoginCode(email, input.code);
  if (wrong) return wrong;

  const user = await findStaff(email);
  if (!user) return { ok: false, error: "Неверный код" };

  console.log(`[вход в админку] ${email} в ${new Date().toISOString()}`);
  await writeAudit(user, "login.staff", "user", user.id, "Вход в админку", await clientIp());
  await createSession(user.id);
  redirect("/admin");
}

export async function staffLogout() {
  await destroySession();
  redirect("/admin/login");
}
