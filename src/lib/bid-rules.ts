// Правила запечатанных КП (раздел 6 SPEC.md). Чистые функции — покрыты тестами.
import type { UserRole } from "@prisma/client";

/** КП запечатаны, пока не наступил дедлайн. Нет дедлайна — запечатаны. Время — серверное. */
export function isSealed(deadlineAt: Date | null, now: Date): boolean {
  return !deadlineAt || now.getTime() < deadlineAt.getTime();
}

type Viewer = { role: UserRole; companyId: string | null };

/**
 * Кто может видеть сумму и скачать файл конкретного КП:
 * - «own»    — компания, подавшая КП, видит своё КП всегда (решение владельца, вариант А);
 * - «opened» — снабжение/админ, только после дедлайна;
 * - «denied» — все остальные случаи, в т.ч. снабжение до дедлайна и другие подрядчики.
 */
export function bidAccess(viewer: Viewer, bidCompanyId: string, deadlineAt: Date | null, now: Date): "own" | "opened" | "denied" {
  if (viewer.role === "contractor") return viewer.companyId !== null && viewer.companyId === bidCompanyId ? "own" : "denied";
  if (viewer.role === "buyer" || viewer.role === "admin") return isSealed(deadlineAt, now) ? "denied" : "opened";
  return "denied";
}

/** Можно ли подать или заменить КП прямо сейчас. null — можно, иначе текст причины. */
export function submitBlocker(tender: { status: string; deadlineAt: Date | null }, now: Date): string | null {
  if (tender.status !== "open") return "Приём КП по этому тендеру сейчас не идёт";
  if (!tender.deadlineAt || now.getTime() >= tender.deadlineAt.getTime()) return "Приём КП завершён — срок подачи истёк";
  return null;
}

export const BID_MAX_BYTES = 20 * 1024 * 1024;

export type BidInput = { totalWithVat: number; durationDays: number; advancePercent: number; comment: string | null };

/** Проверка полей КП. Возвращает текст ошибки или null. */
export function checkBidInput(v: BidInput): string | null {
  if (!Number.isFinite(v.totalWithVat) || v.totalWithVat <= 0) return "Укажите итоговую сумму с НДС";
  if (v.totalWithVat >= 1e13) return "Слишком большая сумма — проверьте, нет ли лишних цифр";
  if (Math.abs(v.totalWithVat * 100 - Math.round(v.totalWithVat * 100)) > 1e-6) return "Сумма — не больше двух знаков после запятой (копейки)";
  if (!Number.isInteger(v.durationDays) || v.durationDays < 1 || v.durationDays > 3650) return "Срок выполнения — целое число дней от 1 до 3650";
  if (!Number.isFinite(v.advancePercent) || v.advancePercent < 0 || v.advancePercent > 100) return "Аванс — от 0 до 100%";
  if (v.comment && v.comment.length > 2000) return "Комментарий — не длиннее 2000 символов";
  return null;
}

/** «1 234 567,89» / «1 234 567,89 ₽» → число. Пробелы и запятая допускаются. */
export function parseMoney(raw: string | null): number {
  if (!raw) return Number.NaN;
  const clean = raw
    .replace(/[\s  ]/g, "")
    .replace(/(₽|руб\.?)$/i, "")
    .replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(clean)) return Number.NaN;
  return Number(clean);
}
