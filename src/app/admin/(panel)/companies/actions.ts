"use server";

import { revalidatePath } from "next/cache";
import { requireAdminAction } from "@/lib/access";
import { updateCompany } from "@/lib/companies";
import type { ActionResult } from "@/components/ActionForm";

export async function updateCompanyAction(id: string, fd: FormData): Promise<ActionResult> {
  const user = await requireAdminAction();
  const ratingRaw = String(fd.get("rating") ?? "");
  const res = await updateCompany(user, id, { status: String(fd.get("status") ?? ""), rating: ratingRaw ? Number(ratingRaw) : null });
  if ("error" in res) return { error: res.error };
  revalidatePath("/admin/companies", "layout");
  return { message: "Сохранено" };
}
