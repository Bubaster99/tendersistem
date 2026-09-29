import type { DocumentKind, Prisma, TenderStatus } from "@prisma/client";
import { formatDay } from "./time";

/** Группы для подрядчика: «Нужны сейчас», «Скоро», «Завершённые». */
export type TenderGroup = "open" | "planned" | "done";

export function tenderGroup(status: TenderStatus): TenderGroup | null {
  if (status === "open") return "open";
  if (status === "planned") return "planned";
  if (status === "closed" || status === "rebid" || status === "awarded") return "done";
  return null; // отменённые подрядчикам не показываем
}

/** Порядок в общем списке: приём КП → скоро → завершённые. */
export const GROUP_ORDER: Record<TenderGroup, number> = { open: 0, planned: 1, done: 2 };

export const GROUP_LABEL: Record<TenderGroup, string> = {
  open: "Приём КП",
  planned: "Скоро",
  done: "Завершён",
};

/** Какие тендеры видит подрядчик: опубликованные, не отменённые, на опубликованном объекте. */
export const visibleTenderWhere: Prisma.TenderWhereInput = {
  publishedAt: { not: null },
  status: { not: "cancelled" },
  project: { isPublished: true },
};

export function isTenderVisible(t: { publishedAt: Date | null; status: TenderStatus; project: { isPublished: boolean } }) {
  return t.publishedAt !== null && t.status !== "cancelled" && t.project.isPublished;
}

/** Сортировка для подрядчика: по группе, затем открытые — по ближайшему дедлайну. */
export function sortForContractor<T extends { status: TenderStatus; deadlineAt: Date | null; createdAt: Date }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const ga = GROUP_ORDER[tenderGroup(a.status) ?? "done"];
    const gb = GROUP_ORDER[tenderGroup(b.status) ?? "done"];
    if (ga !== gb) return ga - gb;
    if (a.status === "open" && b.status === "open") {
      return (a.deadlineAt?.getTime() ?? Infinity) - (b.deadlineAt?.getTime() ?? Infinity);
    }
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

/** Строка срока: «Приём до 12 октября» / «Старт: декабрь 2026» / «Приём завершён». */
export function termLine(t: { status: TenderStatus; deadlineAt: Date | null; plannedStart: string | null }, now = new Date()): string {
  if (t.status === "open") return t.deadlineAt ? `Приём до ${formatDay(t.deadlineAt, now)}` : "Приём КП открыт";
  if (t.status === "planned") return t.plannedStart ? `Старт: ${t.plannedStart}` : "Скоро";
  if (t.status === "awarded") return "Итоги подведены";
  return "Приём завершён";
}

/** Названия статусов для снабжения. */
export const STATUS_LABEL_ADMIN: Record<TenderStatus, string> = {
  planned: "Скоро",
  open: "Приём КП",
  closed: "Приём закрыт",
  rebid: "Переторжка",
  awarded: "Победитель выбран",
  cancelled: "Отменён",
};

export const DOCUMENT_KIND_LABEL: Record<DocumentKind, string> = {
  bom_template: "ВОР и шаблон КП",
  tz: "Техническое задание",
  contract: "Проект договора",
  drawings: "Чертежи",
  other: "Прочее",
};

/** Порядок документов в списке: сначала ВОР. */
export const DOCUMENT_KIND_ORDER: DocumentKind[] = ["bom_template", "tz", "contract", "drawings", "other"];
