import Link from "next/link";
import { MapPin } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUserPage } from "@/lib/access";
import { visibleTenderWhere } from "@/lib/tenders";
import { ProjectCover } from "@/components/ProjectCover";
import { SubscribeBanner } from "@/components/SubscribeBanner";

export const metadata = { title: "Объекты — Тендерная площадка" };

export default async function ObjectsPage() {
  await requireUserPage();
  const projects = await prisma.project.findMany({
    where: { isPublished: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { tenders: { where: visibleTenderWhere, select: { status: true } } },
  });

  return (
    <div>
      <h1 className="font-display text-2xl sm:text-3xl">Объекты</h1>
      <p className="mt-2 text-muted">Жилые комплексы, на которые мы ищем подрядчиков.</p>

      <div className="mt-6">
        <SubscribeBanner />
      </div>

      {projects.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-line bg-card p-6 text-muted">Объекты скоро появятся.</div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const open = p.tenders.filter((t) => t.status === "open").length;
            const soon = p.tenders.filter((t) => t.status === "planned").length;
            return (
              <div key={p.id} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-card">
                <ProjectCover id={p.id} coverImage={p.coverImage} className="aspect-[16/9] w-full" />
                <div className="flex flex-1 flex-col p-5">
                  <h2 className="font-display text-lg leading-snug">{p.name}</h2>
                  {p.address && (
                    <p className="mt-1.5 flex items-start gap-1.5 text-sm text-muted">
                      <MapPin size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
                      {p.address}
                    </p>
                  )}
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                    {p.stage && (
                      <>
                        <dt className="text-muted">Стадия</dt>
                        <dd>{p.stage}</dd>
                      </>
                    )}
                    {p.finishDate && (
                      <>
                        <dt className="text-muted">Ввод</dt>
                        <dd>{p.finishDate}</dd>
                      </>
                    )}
                  </dl>
                  <div className="mt-4 flex flex-wrap gap-2 text-sm">
                    <span className="rounded-full bg-open-bg px-2.5 py-1 text-open">{tenderCount(open)} — приём КП</span>
                    <span className="rounded-full bg-soon-bg px-2.5 py-1 text-soon">{soon} скоро</span>
                  </div>
                  <div className="mt-auto pt-5">
                    <Link
                      href={`/objects/${p.id}`}
                      className="flex h-11 items-center justify-center rounded-[10px] bg-accent px-5 font-medium text-white hover:opacity-90"
                    >
                      Смотреть работы
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** «1 тендер», «3 тендера», «5 тендеров» */
function tenderCount(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  const word = m10 === 1 && m100 !== 11 ? "тендер" : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? "тендера" : "тендеров";
  return `${n} ${word}`;
}
