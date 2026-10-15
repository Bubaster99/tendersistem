import "server-only";
// Подписка на новые тендеры (раздел 4.9) и мини-анкета первого входа (раздел 4.2).
import { prisma } from "./db";

export type SubscriptionData = { workTypeIds: string[]; projectIds: string[]; byEmail: boolean };

export type ExperienceItem = { name: string; year: string; amount: string; workType: string };

export const MAX_EXPERIENCE = 5;

/** Оставляем только существующие виды работ и опубликованные объекты — чужие id из формы не сохраняем. */
async function cleanIds(workTypeIds: string[], projectIds: string[]) {
  const [wt, pr] = await Promise.all([
    prisma.workType.findMany({ where: { id: { in: workTypeIds } }, select: { id: true } }),
    prisma.project.findMany({ where: { id: { in: projectIds }, isPublished: true }, select: { id: true } }),
  ]);
  return { workTypeIds: wt.map((w) => w.id), projectIds: pr.map((p) => p.id) };
}

export async function getSubscription(companyId: string): Promise<SubscriptionData | null> {
  const s = await prisma.subscription.findUnique({ where: { companyId } });
  return s && { workTypeIds: s.workTypeIds, projectIds: s.projectIds, byEmail: s.byEmail };
}

export async function saveSubscription(companyId: string, input: SubscriptionData): Promise<string | null> {
  const ids = await cleanIds(input.workTypeIds, input.projectIds);
  if (input.byEmail && ids.workTypeIds.length === 0) return "Выберите хотя бы один вид работ";
  const data = { ...ids, byEmail: input.byEmail };
  await prisma.subscription.upsert({ where: { companyId }, create: { companyId, ...data }, update: data });
  return null;
}

/** Проверка строки опыта. null — всё в порядке. */
export function checkExperience(items: ExperienceItem[], currentYear = new Date().getFullYear()): string | null {
  if (items.length > MAX_EXPERIENCE) return `Не больше ${MAX_EXPERIENCE} объектов опыта`;
  for (const [i, e] of items.entries()) {
    if (!e.name) return `Объект ${i + 1}: укажите название`;
    if (e.year && (!/^\d{4}$/.test(e.year) || Number(e.year) < 1980 || Number(e.year) > currentYear)) {
      return `Объект ${i + 1}: год — четыре цифры, не позже ${currentYear}`;
    }
  }
  return null;
}

/**
 * Мини-анкета: виды работ, регион, опыт. Заполнение = подписка на выбранные виды работ по email.
 * Объекты в подписке не трогаем (пусто = все объекты).
 */
export async function saveOnboarding(
  companyId: string,
  input: { workTypeIds: string[]; region: string | null; experience: ExperienceItem[] },
): Promise<string | null> {
  const bad = checkExperience(input.experience);
  if (bad) return bad;
  const { workTypeIds } = await cleanIds(input.workTypeIds, []);
  if (workTypeIds.length === 0) return "Выберите хотя бы один вид работ";

  await prisma.$transaction([
    prisma.company.update({
      where: { id: companyId },
      data: {
        workTypes: workTypeIds,
        region: input.region,
        experience: input.experience.length ? JSON.stringify(input.experience) : null,
        onboardedAt: new Date(),
      },
    }),
    prisma.subscription.upsert({
      where: { companyId },
      create: { companyId, workTypeIds, byEmail: true },
      update: { workTypeIds, byEmail: true },
    }),
  ]);
  return null;
}

/** «Пропустить» — анкета больше не показывается. */
export async function skipOnboarding(companyId: string): Promise<void> {
  await prisma.company.update({ where: { id: companyId }, data: { onboardedAt: new Date() } });
}
