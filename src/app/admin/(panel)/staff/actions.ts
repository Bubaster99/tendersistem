"use server";

import { revalidatePath } from "next/cache";
import { requireAdminAction } from "@/lib/access";
import { str } from "@/lib/form";
import { addStaff, removeStaff, setStaffRole } from "@/lib/staff";
import type { ActionResult } from "@/components/ActionForm";

export async function addStaffAction(fd: FormData): Promise<ActionResult> {
  const user = await requireAdminAction();
  const res = await addStaff(user, str(fd, "email", 200) ?? "", str(fd, "name", 200), String(fd.get("role") ?? ""));
  if ("error" in res) return { error: res.error };
  revalidatePath("/admin/staff");
  return { message: "Сотрудник добавлен. Он входит по адресу /admin/login — по email и коду" };
}

export async function setStaffRoleAction(userId: string, fd: FormData): Promise<ActionResult> {
  const user = await requireAdminAction();
  const res = await setStaffRole(user, userId, String(fd.get("role") ?? ""));
  if ("error" in res) return { error: res.error };
  revalidatePath("/admin/staff");
  return { message: "Роль изменена" };
}

export async function removeStaffAction(userId: string): Promise<ActionResult> {
  const user = await requireAdminAction();
  const res = await removeStaff(user, userId);
  if ("error" in res) return { error: res.error };
  revalidatePath("/admin/staff");
}
