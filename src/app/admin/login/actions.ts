"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isStaffRole } from "@/lib/access";
import { consumeLoginCode, issueLoginCode, type Fail } from "@/lib/login-flow";
import { createSession, destroySession } from "@/lib/session";
import { isValidEmail, normalizeEmail } from "@/lib/validation";

const NOT_STAFF = "Этот email не зарегистрирован как сотрудник снабжения";

async function findStaff(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  return user && isStaffRole(user.role) ? user : null;
}

/** Вход сотрудника: только email, без ИНН. Код получают только сотрудники (buyer/admin). */
export async function requestStaffCode(rawEmail: string): Promise<{ ok: true } | Fail> {
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) return { ok: false, error: "Проверьте email — похоже, в нём ошибка" };
  if (!(await findStaff(email))) return { ok: false, error: NOT_STAFF };
  return issueLoginCode(email);
}

export async function verifyStaffCode(input: { email: string; code: string }): Promise<Fail> {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) return { ok: false, error: "Начните вход заново" };
  const wrong = await consumeLoginCode(email, input.code);
  if (wrong) return wrong;

  const user = await findStaff(email);
  if (!user) return { ok: false, error: NOT_STAFF };

  console.log(`[вход в админку] ${email} в ${new Date().toISOString()}`);
  await createSession(user.id);
  redirect("/admin");
}

export async function staffLogout() {
  await destroySession();
  redirect("/admin/login");
}
