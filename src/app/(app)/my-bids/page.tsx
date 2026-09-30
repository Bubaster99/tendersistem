import Link from "next/link";
import { Download, FileSpreadsheet } from "lucide-react";
import { requireUserPage } from "@/lib/access";
import { closeExpiredTenders, listOwnBids } from "@/lib/bids";
import { bidStage, formatMoney, formatPercent } from "@/lib/bid-rules";
import { formatSize } from "@/lib/files";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "Мои заявки — Тендерная площадка" };

const STAGE_STYLE = {
  Подано: "bg-open-bg text-open",
  Вскрыто: "bg-closed-bg text-closed",
} as const;

export default async function MyBidsPage() {
  const user = await requireUserPage();
  await closeExpiredTenders();
  const bids = await listOwnBids(user);
  const now = new Date();

  return (
    <div>
      <h1 className="font-display text-2xl sm:text-3xl">Мои заявки</h1>
      <p className="mt-2 text-muted">Ваши коммерческие предложения. До окончания приёма их никто, кроме вас, не видит.</p>

      {bids.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-line bg-card p-6 text-muted">
          {user.role === "contractor" ? (
            <>
              Вы пока не подавали КП.{" "}
              <Link href="/tenders?f=open" className="text-accent underline underline-offset-2">
                Тендеры с приёмом КП
              </Link>
            </>
          ) : (
            "Здесь подрядчики видят свои КП. Вы вошли как сотрудник."
          )}
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {bids.map((b) => {
            const stage = bidStage(b.tender.deadlineAt, now);
            return (
              <div key={b.id} className="rounded-2xl border border-line bg-card p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STAGE_STYLE[stage]}`}>{stage}</span>
                  <span className="text-sm text-muted">
                    {stage === "Подано"
                      ? b.tender.deadlineAt && `Вскрытие после ${formatDateTime(b.tender.deadlineAt, now)}`
                      : "Приём завершён, КП переданы снабжению"}
                  </span>
                </div>
                <Link href={`/tenders/${b.tender.id}`} className="mt-2 block font-medium leading-snug hover:text-accent">
                  {b.tender.title}
                </Link>
                <p className="mt-0.5 text-sm text-muted">
                  {b.tender.project.name} · {b.tender.workType.name}
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Fact k="Итого с НДС" v={formatMoney(b.totalWithVat)} />
                  <Fact k="Срок" v={`${b.durationDays} дн.`} />
                  <Fact k="Аванс" v={formatPercent(b.advancePercent)} />
                  <Fact k={b.replacedAt ? "Заменено" : "Подано"} v={formatDateTime(b.replacedAt ?? b.submittedAt, now)} />
                </dl>
                <a href={`/api/bids/${b.id}/file`} className="-mx-2 mt-2 flex items-center gap-3 rounded-[10px] px-2 py-2 hover:bg-bg">
                  <FileSpreadsheet size={20} strokeWidth={1.5} className="shrink-0 text-muted" />
                  <span className="min-w-0 flex-1 break-words text-sm">
                    {b.fileName} <span className="text-muted">· {formatSize(b.fileSize)}</span>
                  </span>
                  <Download size={18} strokeWidth={1.75} className="shrink-0 text-muted" />
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-[10px] bg-bg px-3 py-2">
      <dt className="text-xs text-muted">{k}</dt>
      <dd className="mt-0.5 text-sm font-medium">{v}</dd>
    </div>
  );
}
