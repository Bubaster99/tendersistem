"use server";

import { revalidatePath } from "next/cache";
import { requireAdminAction, requireStaffAction } from "@/lib/access";
import { addCompanyNote, updateCompanyStatus } from "@/lib/companies";
import { str } from "@/lib/form";
import type { ActionResult } from "@/components/ActionForm";

/** Статус подрядчика — только администратор. */
export async function updateCompanyAction(id: string, fd: FormData): Promise<ActionResult> {
  const user = await requireAdminAction();
  const res = await updateCompanyStatus(user, id, String(fd.get("status") ?? ""));
  if ("error" in res) return { error: res.error };
  revalidatePath("/admin/companies", "layout");
  return { message: "Статус сохранён" };
}

/** Оценка и комментарий — любой сотрудник. */
export async function addCompanyNoteAction(id: string, fd: FormData): Promise<ActionResult> {
  const user = await requireStaffAction();
  const ratingRaw = String(fd.get("rating") ?? "");
  const res = await addCompanyNote(user, id, { rating: ratingRaw ? Number(ratingRaw) : null, text: str(fd, "text", 2001) });
  if ("error" in res) return { error: res.error };
  revalidatePath("/admin/companies", "layout");
  return { message: "Сохранено" };
}
