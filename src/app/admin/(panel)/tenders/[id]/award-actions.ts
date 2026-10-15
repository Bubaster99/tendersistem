"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireAdminAction, requireStaffAction } from "@/lib/access";
import { chooseWinner, saveBudget, startRebid } from "@/lib/award";
import { parseMoney } from "@/lib/bid-rules";
import { str } from "@/lib/form";
import { notifyRebidInvite, notifyResults } from "@/lib/notify";
import { parseMoscowInput } from "@/lib/time";
import type { ActionResult } from "@/components/ActionForm";

/** Бюджет: вводится вручную, подрядчики не видят. */
export async function saveBudgetAction(tenderId: string, fd: FormData): Promise<ActionResult> {
  const user = await requireStaffAction();
  const raw = str(fd, "budget", 40);
  const budget = raw ? parseMoney(raw) : null;
  if (budget !== null && Number.isNaN(budget)) return { error: "Бюджет — число, например 12 500 000" };
  const res = await saveBudget(user, tenderId, budget);
  if ("error" in res) return { error: res.error };
  revalidatePath(`/admin/tenders/${tenderId}`);
  return { message: budget === null ? "Бюджет очищен" : "Бюджет сохранён" };
}

/** «Переторжка с отмеченными»: отмеченные участники + новый срок → письма-приглашения. */
export async function startRebidAction(tenderId: string, fd: FormData): Promise<ActionResult> {
  const user = await requireStaffAction();
  const companyIds = fd.getAll("company").filter((v): v is string => typeof v === "string" && v.length <= 50);
  const deadline = parseMoscowInput(str(fd, "rebidDeadline", 30));
  const res = await startRebid(user, tenderId, companyIds, deadline);
  if ("error" in res) return { error: res.error };
  after(() => notifyRebidInvite(tenderId, companyIds, deadline!));
  revalidatePath("/", "layout");
  return { message: `Переторжка начата, приглашений: ${new Set(companyIds).size}` };
}

/** «Выбрать победителя»: письмо победителю со списком документов, остальным — «выбран другой участник». */
export async function chooseWinnerAction(tenderId: string, fd: FormData): Promise<ActionResult> {
  const user = await requireAdminAction();
  const companyId = str(fd, "winner", 50);
  if (!companyId) return { error: "Выберите победителя" };
  const documents = (str(fd, "documents", 5000) ?? "")
    .split("\n")
    .map((l) => l.replace(/^[\s\-—•*\d.)]+/, "").trim())
    .filter(Boolean)
    .slice(0, 30);
  const res = await chooseWinner(user, tenderId, companyId);
  if ("error" in res) return { error: res.error };
  after(() => notifyResults(tenderId, companyId, documents));
  revalidatePath("/", "layout");
  return { message: "Победитель выбран, письма участникам отправляются" };
}
