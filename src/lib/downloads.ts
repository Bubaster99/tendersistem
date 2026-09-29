import "server-only";
import { prisma } from "./db";
import { getCurrentUser } from "./session";
import { isStaffRole } from "./access";
import { isTenderVisible } from "./tenders";

type User = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** Документацию тендера скачивают только вошедшие: сотрудники — любую, подрядчики — только видимых тендеров. */
export function canDownload(
  user: User,
  tender: { publishedAt: Date | null; status: Parameters<typeof isTenderVisible>[0]["status"]; project: { isPublished: boolean } },
): boolean {
  return isStaffRole(user.role) || isTenderVisible(tender);
}

/** Запоминаем, что компания скачивала документацию (для счётчика и напоминаний). */
export async function trackDownload(user: User, tenderId: string): Promise<void> {
  if (user.role !== "contractor" || !user.companyId) return;
  const now = new Date();
  await prisma.documentDownload.upsert({
    where: { companyId_tenderId: { companyId: user.companyId, tenderId } },
    create: { companyId: user.companyId, tenderId, firstAt: now, lastAt: now },
    update: { lastAt: now },
  });
}

export const NO_STORE = { "Cache-Control": "private, no-store" };
