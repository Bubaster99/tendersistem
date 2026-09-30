import "server-only";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { getCurrentUser } from "./session";

export function isStaffRole(role: UserRole): boolean {
  return role === "buyer" || role === "admin";
}

/** Страницы админки: без входа или не сотрудник — на вход в админку. */
export async function requireStaffPage() {
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.role)) redirect("/admin/login");
  return user;
}

/** Страницы подрядчика: любой вошедший пользователь (сотрудники тоже могут посмотреть, как видят подрядчики). */
export async function requireUserPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Действия админки (server actions): проверка прав при каждом вызове. */
export async function requireStaffAction() {
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.role)) throw new Error("Нет доступа");
  return user;
}
