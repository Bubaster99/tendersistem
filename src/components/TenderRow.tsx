import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { TenderStatus } from "@prisma/client";
import { StatusBadge } from "./StatusBadge";
import { termLine } from "@/lib/tenders";

type Row = {
  id: string;
  title: string;
  status: TenderStatus;
  deadlineAt: Date | null;
  plannedStart: string | null;
  workType: { name: string };
  project?: { name: string };
};

/** Строка тендера: название, вид работ, срок, кнопка. */
export function TenderRow({ tender, showProject = false, submitted = false }: { tender: Row; showProject?: boolean; submitted?: boolean }) {
  const t = tender;
  return (
    <Link href={`/tenders/${t.id}`} className="group flex items-center gap-3 p-4 transition hover:bg-bg sm:gap-4 sm:px-5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={t.status} />
          {submitted && <span className="inline-flex shrink-0 items-center rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium whitespace-nowrap text-accent">Вы подали КП</span>}
          <span className="text-sm text-muted">{termLine(t)}</span>
        </div>
        <p className="mt-1.5 font-medium leading-snug group-hover:text-accent">{t.title}</p>
        <p className="mt-0.5 text-sm text-muted">
          {showProject && t.project ? `${t.project.name} · ` : ""}
          {t.workType.name}
        </p>
      </div>
      <span className="hidden h-11 shrink-0 items-center rounded-[10px] border border-line px-4 text-sm font-medium sm:inline-flex">
        {t.status === "open" ? (submitted ? "Моё КП" : "Подать КП") : "Подробнее"}
      </span>
      <ChevronRight size={20} strokeWidth={1.75} className="shrink-0 text-muted sm:hidden" />
    </Link>
  );
}
