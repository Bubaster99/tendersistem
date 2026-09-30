import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUserPage } from "@/lib/access";
import { closeExpiredTenders, ownBidTenderIds } from "@/lib/bids";
import { sortForContractor, tenderGroup, visibleTenderWhere, type TenderGroup } from "@/lib/tenders";
import { ProjectCover } from "@/components/ProjectCover";
import { TenderRow } from "@/components/TenderRow";

const BLOCKS: { group: TenderGroup; title: string; empty: string }[] = [
  { group: "open", title: "Нужны сейчас", empty: "Сейчас приём КП не идёт." },
  { group: "planned", title: "Скоро", empty: "Новых тендеров пока не запланировано." },
  { group: "done", title: "Завершённые", empty: "Завершённых тендеров пока нет." },
];

export default async function ObjectPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUserPage();
  const { id } = await params;
  await closeExpiredTenders();
  const mine = await ownBidTenderIds(user);
  const project = await prisma.project.findFirst({
    where: { id, isPublished: true },
    include: { tenders: { where: visibleTenderWhere, include: { workType: { select: { name: true } } } } },
  });
  if (!project) notFound();

  const tenders = sortForContractor(project.tenders);
  const facts = [
    ["Адрес", project.address],
    ["Стадия", project.stage],
    ["Срок ввода", project.finishDate],
    ["Этажность", project.size],
  ].filter((f): f is [string, string] => !!f[1]);

  return (
    <div>
      <Link href="/objects" className="text-sm text-muted hover:text-ink">
        ← Все объекты
      </Link>

      <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-card md:flex">
        <ProjectCover id={project.id} coverImage={project.coverImage} className="aspect-[16/9] w-full md:aspect-auto md:w-[360px] md:shrink-0" />
        <div className="p-5 sm:p-6">
          <h1 className="font-display text-2xl leading-tight sm:text-3xl">{project.name}</h1>
          {project.address && (
            <p className="mt-2 flex items-start gap-1.5 text-muted">
              <MapPin size={18} strokeWidth={1.75} className="mt-0.5 shrink-0" />
              {project.address}
            </p>
          )}
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {facts
              .filter(([k]) => k !== "Адрес")
              .map(([k, v]) => (
                <div key={k} className="rounded-[10px] bg-bg px-3 py-2">
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="mt-0.5 text-sm font-medium">{v}</dd>
                </div>
              ))}
          </dl>
        </div>
      </div>

      {BLOCKS.map((b) => {
        const list = tenders.filter((t) => tenderGroup(t.status) === b.group);
        return (
          <section key={b.group} className="mt-8">
            <h2 className="font-display text-lg">
              {b.title} <span className="text-muted">{list.length}</span>
            </h2>
            <div className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
              {list.length === 0 ? <p className="p-5 text-muted">{b.empty}</p> : list.map((t) => <TenderRow key={t.id} tender={t} submitted={mine.has(t.id)} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
