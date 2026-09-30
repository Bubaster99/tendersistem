"use server";

import { revalidatePath } from "next/cache";
import { requireUserAction } from "@/lib/access";
import { closeExpiredTenders, setWatch, submitBid } from "@/lib/bids";
import { parseMoney } from "@/lib/bid-rules";
import { decimal, file, str } from "@/lib/form";
import { clientIp } from "@/lib/request-ip";
import type { ActionResult } from "@/components/ActionForm";

/** «Отправить КП» и «Заменить КП». Все проверки — в submitBid (сервер). */
export async function submitBidAction(tenderId: string, fd: FormData): Promise<ActionResult> {
  const user = await requireUserAction();
  await closeExpiredTenders();
  const days = str(fd, "durationDays", 10);
  const res = await submitBid(
    user,
    tenderId,
    {
      totalWithVat: parseMoney(str(fd, "totalWithVat", 40)),
      durationDays: days && /^\d+$/.test(days) ? Number(days) : Number.NaN,
      advancePercent: decimal(fd, "advancePercent") ?? Number.NaN,
      comment: str(fd, "comment", 2001),
    },
    file(fd, "file"),
    await clientIp(),
  );
  revalidatePath("/", "layout");
  if ("error" in res) return { error: res.error };
  return { message: res.replaced ? "КП заменено" : "КП принято" };
}

/** «Сообщить о старте» / «Не сообщать». */
export async function watchAction(tenderId: string, on: boolean): Promise<ActionResult> {
  const user = await requireUserAction();
  const err = await setWatch(user, tenderId, on);
  revalidatePath(`/tenders/${tenderId}`);
  if (err) return { error: err };
}
