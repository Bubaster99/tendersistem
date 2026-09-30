import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "./session";
import { isStaffRole } from "./access-rules";

export { isStaffRole };

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

/** Действия подрядчика (server actions): любой вошедший; права на конкретное действие проверяются дальше. */
export async function requireUserAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Нужно войти");
  return user;
}
