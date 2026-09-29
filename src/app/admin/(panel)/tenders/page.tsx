import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/access";
import { btnPrimary, cardCls } from "@/components/ui";
import { AdminStatusBadge } from "@/components/StatusBadge";
import { formatDateTime } from "@/lib/time";

export default async function AdminTendersPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  await requireStaffPage();
  const { project } = await searchParams;

  const [projects, tenders] = await Promise.all([
    prisma.project.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, name: true } }),
    prisma.tender.findMany({
      where: project ? { projectId: project } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        project: { select: { name: true } },
        workType: { select: { name: true } },
        _count: { select: { downloads: true, documents: true } },
      },
    }),
  ]);

  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-3.5 py-2 text-sm transition ${active ? "border-ink bg-ink text-white" : "border-line bg-card hover:bg-bg"}`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl">Тендеры</h1>
        <Link href="/admin/tenders/new" className={btnPrimary}>
          <Plus size={18} strokeWidth={1.75} /> Новый тендер
        </Link>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link href="/admin/tenders" className={chip(!project)}>
          Все объекты
        </Link>
        {projects.map((p) => (
          <Link key={p.id} href={`/admin/tenders?project=${p.id}`} className={chip(project === p.id)}>
            {p.name}
          </Link>
        ))}
      </div>

      <div className={`${cardCls} mt-5 overflow-x-auto`}>
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="px-4 py-3 font-normal">Тендер</th>
              <th className="px-4 py-3 font-normal">Статус</th>
              <th className="px-4 py-3 font-normal">Приём КП до</th>
              <th className="px-4 py-3 font-normal" title="Сколько компаний скачали документацию">
                Скачали док.
              </th>
              <th className="px-4 py-3 font-normal" title="Появится на этапе подачи КП">
                Подали КП
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {tenders.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-5 text-muted">
                  Тендеров пока нет.
                </td>
              </tr>
            )}
            {tenders.map((t) => (
              <tr key={t.id} className="hover:bg-bg">
                <td className="px-4 py-3">
                  <Link href={`/admin/tenders/${t.id}`} className="font-medium hover:text-accent">
                    {t.title}
                  </Link>
                  <p className="text-muted">
                    {t.project.name} · {t.workType.name} · документов: {t._count.documents}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <AdminStatusBadge status={t.status} published={!!t.publishedAt} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{t.deadlineAt ? formatDateTime(t.deadlineAt) : "—"}</td>
                <td className="px-4 py-3">{t._count.downloads}</td>
                <td className="px-4 py-3 text-muted">—</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
