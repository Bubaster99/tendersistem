import Link from "next/link";
import { Download, FileSpreadsheet } from "lucide-react";
import { requireUserPage } from "@/lib/access";
import { closeExpiredTenders, listOwnBids } from "@/lib/bids";
import { contractorStage, formatMoney, formatPercent, type ContractorStage } from "@/lib/bid-rules";
import { formatSize } from "@/lib/files";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "Мои заявки — Тендерная площадка" };

const STAGE_STYLE: Record<ContractorStage, string> = {
  Подано: "bg-open-bg text-open",
  Вскрыто: "bg-closed-bg text-closed",
  Переторжка: "bg-soon-bg text-soon",
  "Ваше КП выбрано": "bg-accent text-white",
  "Выбран другой участник": "bg-closed-bg text-closed",
};

const STAGE_NOTE: Record<Exclude<ContractorStage, "Подано">, string> = {
  Вскрыто: "Приём завершён, КП переданы снабжению",
  Переторжка: "Вас пригласили на переторжку — можно подать улучшенное КП",
  "Ваше КП выбрано": "Поздравляем! Письмо с дальнейшими шагами отправлено на вашу почту",
  "Выбран другой участник": "Спасибо за участие",
};

export default async function MyBidsPage() {
  const user = await requireUserPage();
  await closeExpiredTenders();
  // По каждому тендеру — последнее КП: переторжка (раунд 2), если подано, иначе основное.
  const all = await listOwnBids(user);
  const latest = new Map<string, (typeof all)[number]>();
  for (const b of all) if (!latest.has(b.tenderId) || b.round > latest.get(b.tenderId)!.round) latest.set(b.tenderId, b);
  const bids = all.filter((b) => latest.get(b.tenderId) === b);
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
            const stage = contractorStage(b.tender, user.companyId ?? "", b.tender.rebidInvites.length > 0, now);
            const sealUntil = b.round === 2 ? b.tender.rebidDeadlineAt : b.tender.deadlineAt;
            return (
              <div key={b.id} className="rounded-2xl border border-line bg-card p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STAGE_STYLE[stage]}`}>{stage}</span>
                  <span className="text-sm text-muted">
                    {stage === "Подано"
                      ? sealUntil && `Вскрытие после ${formatDateTime(sealUntil, now)}`
                      : stage === "Переторжка" && b.round === 2 && sealUntil
                        ? `КП переторжки подано, вскрытие после ${formatDateTime(sealUntil, now)}`
                        : STAGE_NOTE[stage]}
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
