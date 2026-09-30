import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUserPage } from "@/lib/access";
import { closeExpiredTenders, ownBidTenderIds } from "@/lib/bids";
import { sortForContractor, tenderGroup, visibleTenderWhere, type TenderGroup } from "@/lib/tenders";
import { TenderRow } from "@/components/TenderRow";

export const metadata = { title: "Тендеры — Тендерная площадка" };

const FILTERS: { key: TenderGroup | "all"; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "open", label: "Приём КП" },
  { key: "planned", label: "Скоро" },
  { key: "done", label: "Завершённые" },
];

export default async function TendersPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const user = await requireUserPage();
  const { f } = await searchParams;
  await closeExpiredTenders();
  const mine = await ownBidTenderIds(user);
  const filter = FILTERS.find((x) => x.key === f)?.key ?? "all";

  const all = sortForContractor(
    await prisma.tender.findMany({
      where: visibleTenderWhere,
      include: { workType: { select: { name: true } }, project: { select: { name: true } } },
    }),
  );
  const list = filter === "all" ? all : all.filter((t) => tenderGroup(t.status) === filter);

  return (
    <div>
      <h1 className="font-display text-2xl sm:text-3xl">Тендеры</h1>
      <p className="mt-2 text-muted">Все тендеры по всем объектам.</p>

      <div className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((x) => {
          const count = x.key === "all" ? all.length : all.filter((t) => tenderGroup(t.status) === x.key).length;
          const active = x.key === filter;
          return (
            <Link
              key={x.key}
              href={x.key === "all" ? "/tenders" : `/tenders?f=${x.key}`}
              className={`shrink-0 rounded-full border px-4 py-2.5 text-sm transition ${
                active ? "border-ink bg-ink text-white" : "border-line bg-card hover:bg-bg"
              }`}
            >
              {x.label} <span className={active ? "text-white/70" : "text-muted"}>{count}</span>
            </Link>
          );
        })}
      </div>

      <div className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
        {list.length === 0 ? (
          <p className="p-5 text-muted">Здесь пока пусто.</p>
        ) : (
          list.map((t) => <TenderRow key={t.id} tender={t} showProject submitted={mine.has(t.id)} />)
        )}
      </div>
    </div>
  );
}
