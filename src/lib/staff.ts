import "server-only";
// Сотрудники (раздел 5.6): снабженцы и администраторы. Управляет только администратор.
import type { UserRole } from "@prisma/client";
import { prisma } from "./db";
import { writeAudit } from "./audit";
import { isValidEmail, normalizeEmail } from "./validation";

type Actor = { id: string; email: string; role: UserRole };
type StaffRole = "buyer" | "admin";
type Result = { error: string } | { ok: true };

export const STAFF_ROLE_LABEL: Record<StaffRole, string> = { buyer: "Снабженец", admin: "Администратор" };

const isStaffRoleValue = (r: string): r is StaffRole => r === "buyer" || r === "admin";

export async function listStaff() {
  return prisma.user.findMany({
    where: { role: { in: ["buyer", "admin"] } },
    orderBy: [{ role: "asc" }, { email: "asc" }],
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
}

/** Добавить сотрудника. Вход — по email и коду, как у всех. */
export async function addStaff(actor: Actor, rawEmail: string, name: string | null, role: string): Promise<Result> {
  if (actor.role !== "admin") return { error: "Нет доступа" };
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) return { error: "Проверьте email" };
  if (!isStaffRoleValue(role)) return { error: "Выберите роль" };
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.role === "contractor") return { error: "Этот email уже зарегистрирован как подрядчик — укажите другой" };
  if (existing) return { error: "Такой сотрудник уже есть" };
  await prisma.user.create({ data: { email, name, role } });
  await writeAudit(actor, "staff.add", "user", email, `${STAFF_ROLE_LABEL[role]}: ${email}`);
  return { ok: true };
}

/** Сменить роль. Свою роль менять нельзя — так в системе всегда остаётся хотя бы один администратор. */
export async function setStaffRole(actor: Actor, userId: string, role: string): Promise<Result> {
  if (actor.role !== "admin") return { error: "Нет доступа" };
  if (!isStaffRoleValue(role)) return { error: "Выберите роль" };
  if (userId === actor.id) return { error: "Свою роль поменять нельзя" };
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role === "contractor") return { error: "Сотрудник не найден" };
  await prisma.user.update({ where: { id: userId }, data: { role } });
  await writeAudit(actor, "staff.role", "user", userId, `${user.email}: ${STAFF_ROLE_LABEL[user.role as StaffRole]} → ${STAFF_ROLE_LABEL[role]}`);
  return { ok: true };
}

/** Удалить сотрудника (доступ закрывается сразу). Себя удалить нельзя. */
export async function removeStaff(actor: Actor, userId: string): Promise<Result> {
  if (actor.role !== "admin") return { error: "Нет доступа" };
  if (userId === actor.id) return { error: "Себя удалить нельзя" };
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role === "contractor") return { error: "Сотрудник не найден" };
  await prisma.user.delete({ where: { id: userId } });
  await writeAudit(actor, "staff.remove", "user", userId, `${user.email}`);
  return { ok: true };
}
