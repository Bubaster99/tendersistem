"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { destroySession } from "@/lib/session";
import { requireUserAction } from "@/lib/access";
import { bool, str } from "@/lib/form";
import { MAX_EXPERIENCE, saveOnboarding, saveSubscription, skipOnboarding, type ExperienceItem } from "@/lib/subscription";
import type { ActionResult } from "@/components/ActionForm";

export async function logout() {
  await destroySession();
  redirect("/login");
}

const ids = (fd: FormData, name: string) =>
  [...new Set(fd.getAll(name).filter((v): v is string => typeof v === "string" && v.length > 0 && v.length <= 50))];

async function requireCompany() {
  const user = await requireUserAction();
  if (user.role !== "contractor" || !user.companyId) throw new Error("Доступно только подрядчикам");
  return user.companyId;
}

/** Панель «Подписка». */
export async function saveSubscriptionAction(fd: FormData): Promise<ActionResult> {
  const companyId = await requireCompany();
  const err = await saveSubscription(companyId, { workTypeIds: ids(fd, "workType"), projectIds: ids(fd, "project"), byEmail: bool(fd, "byEmail") });
  if (err) return { error: err };
  revalidatePath("/", "layout");
  return { message: "Подписка сохранена" };
}

/** Мини-анкета первого входа: «Сохранить». */
export async function saveOnboardingAction(fd: FormData): Promise<ActionResult> {
  const companyId = await requireCompany();
  const experience: ExperienceItem[] = [];
  for (let i = 0; i < MAX_EXPERIENCE; i++) {
    const item = {
      name: str(fd, `exp${i}_name`, 200) ?? "",
      year: str(fd, `exp${i}_year`, 4) ?? "",
      amount: str(fd, `exp${i}_amount`, 50) ?? "",
      workType: str(fd, `exp${i}_workType`, 100) ?? "",
    };
    if (item.name || item.year || item.amount || item.workType) experience.push(item);
  }
  const err = await saveOnboarding(companyId, { workTypeIds: ids(fd, "workType"), region: str(fd, "region", 100), experience });
  if (err) return { error: err };
  revalidatePath("/", "layout");
  redirect("/objects");
}

/** Мини-анкета: «Пропустить». */
export async function skipOnboardingAction(): Promise<void> {
  const companyId = await requireCompany();
  await skipOnboarding(companyId);
  redirect("/objects");
}
