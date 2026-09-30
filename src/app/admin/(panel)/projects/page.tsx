import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/access";
import { btnPrimary, cardCls } from "@/components/ui";

export default async function AdminProjectsPage() {
  await requireStaffPage();
  const projects = await prisma.project.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { tenders: true } } },
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl">Объекты</h1>
        <Link href="/admin/projects/new" className={btnPrimary}>
          <Plus size={18} strokeWidth={1.75} /> Добавить объект
        </Link>
      </div>
      <div className={`${cardCls} mt-6 divide-y divide-line`}>
        {projects.length === 0 && <p className="p-5 text-muted">Объектов пока нет.</p>}
        {projects.map((p) => (
          <Link key={p.id} href={`/admin/projects/${p.id}`} className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-bg">
            <div className="min-w-0">
              <p className="font-medium">{p.name}</p>
              <p className="text-sm text-muted">{[p.address, p.stage, p.finishDate].filter(Boolean).join(" · ")}</p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted">Тендеров: {p._count.tenders}</span>
              {p.isPublished ? (
                <span className="rounded-full bg-open-bg px-2.5 py-1 text-open">Показан</span>
              ) : (
                <span className="rounded-full bg-closed-bg px-2.5 py-1 text-closed">Скрыт</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
