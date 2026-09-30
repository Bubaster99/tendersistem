import type { TenderStatus } from "@prisma/client";
import { GROUP_LABEL, STATUS_LABEL_ADMIN, tenderGroup, type TenderGroup } from "@/lib/tenders";

const STYLE: Record<TenderGroup, string> = {
  open: "bg-open-bg text-open",
  planned: "bg-soon-bg text-soon",
  done: "bg-closed-bg text-closed",
};

const base = "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap";

/** Бейдж для подрядчика: Приём КП / Скоро / Завершён. */
export function StatusBadge({ status }: { status: TenderStatus }) {
  const g = tenderGroup(status) ?? "done";
  return <span className={`${base} ${STYLE[g]}`}>{GROUP_LABEL[g]}</span>;
}

/** Бейдж для снабжения: полный статус, черновик отдельно. */
export function AdminStatusBadge({ status, published }: { status: TenderStatus; published: boolean }) {
  if (!published) return <span className={`${base} border border-line bg-card text-muted`}>Черновик</span>;
  const g = tenderGroup(status) ?? "done";
  return <span className={`${base} ${STYLE[g]}`}>{STATUS_LABEL_ADMIN[status]}</span>;
}
