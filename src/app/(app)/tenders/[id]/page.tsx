import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, CalendarClock, Download, FileSpreadsheet, FileText } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUserPage } from "@/lib/access";
import { formatSize } from "@/lib/files";
import { formatDateTime } from "@/lib/time";
import { DOCUMENT_KIND_LABEL, DOCUMENT_KIND_ORDER, visibleTenderWhere } from "@/lib/tenders";
import { StatusBadge } from "@/components/StatusBadge";
import { ContactCard } from "@/components/ContactCard";

export default async function TenderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUserPage();
  const { id } = await params;
  const tender = await prisma.tender.findFirst({
    where: { id, ...visibleTenderWhere },
    include: {
      project: { select: { id: true, name: true } },
      workType: { select: { name: true } },
      documents: true,
      contact: { include: { workTypes: { select: { name: true }, orderBy: { name: "asc" } } } },
    },
  });
  if (!tender) notFound();

  const docs = [...tender.documents].sort(
    (a, b) => DOCUMENT_KIND_ORDER.indexOf(a.kind) - DOCUMENT_KIND_ORDER.indexOf(b.kind) || a.uploadedAt.getTime() - b.uploadedAt.getTime(),
  );
  const retention = tender.retentionPercent != null ? `${String(tender.retentionPercent).replace(".", ",")}%` : null;
  const facts: [string, React.ReactNode][] = [
    ["Объект", <Link key="p" href={`/objects/${tender.project.id}`} className="underline decoration-line underline-offset-4 hover:text-accent">{tender.project.name}</Link>],
    ["Вид работ", tender.workType.name],
    ["Приём КП до", tender.deadlineAt ? formatDateTime(tender.deadlineAt) : tender.status === "planned" ? tender.plannedStart && `откроется: ${tender.plannedStart}` : null],
    ["Начало работ", tender.workStart],
    ["Условия оплаты", tender.paymentTerms],
    ["Гарантийное удержание", retention],
  ];

  return (
    <div>
      <Link href={`/objects/${tender.project.id}`} className="text-sm text-muted hover:text-ink">
        ← {tender.project.name}
      </Link>

      <div className="mt-3">
        <StatusBadge status={tender.status} />
        <h1 className="mt-3 font-display text-2xl leading-tight sm:text-3xl">{tender.title}</h1>
        <p className="mt-2 text-muted">
          {tender.project.name} · {tender.workType.name}
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="min-w-0 space-y-6">
          <dl className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3">
            {facts.map(([k, v]) => (
              <div key={k} className="rounded-2xl border border-line bg-card px-4 py-3">
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="mt-1 text-[15px] font-medium">{v || "—"}</dd>
              </div>
            ))}
          </dl>

          {tender.scope && (
            <section className="rounded-2xl border border-line bg-card p-5">
              <h2 className="font-display text-lg">Что нужно сделать</h2>
              <p className="mt-3 whitespace-pre-line leading-relaxed">{tender.scope}</p>
            </section>
          )}

          <section className="rounded-2xl border border-line bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg">Документация</h2>
              {docs.length > 0 && (
                <a
                  href={`/api/tenders/${tender.id}/zip`}
                  className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-line px-4 text-sm font-medium hover:bg-bg"
                >
                  <Archive size={18} strokeWidth={1.75} /> Скачать всё одним архивом
                </a>
              )}
            </div>
            {docs.length === 0 ? (
              <p className="mt-3 text-muted">Документы появятся позже.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {docs.map((d) => {
                  const Icon = d.kind === "bom_template" ? FileSpreadsheet : FileText;
                  return (
                    <li key={d.id}>
                      <a href={`/api/documents/${d.id}`} className="-mx-2 flex items-center gap-3 rounded-[10px] px-2 py-3 hover:bg-bg">
                        <Icon size={22} strokeWidth={1.5} className="shrink-0 text-muted" />
                        <div className="min-w-0 flex-1">
                          <p className="break-words font-medium">{d.fileName}</p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted">
                            {d.kind === "bom_template" ? (
                              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">Шаблон для КП</span>
                            ) : (
                              DOCUMENT_KIND_LABEL[d.kind]
                            )}
                            <span>{formatSize(d.size)}</span>
                          </p>
                        </div>
                        <Download size={18} strokeWidth={1.75} className="shrink-0 text-muted" />
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6">
          <StatusPanel status={tender.status} deadlineAt={tender.deadlineAt} plannedStart={tender.plannedStart} />
          {tender.contact && (
            <div>
              <p className="mb-2 text-sm text-muted">Ответственный снабженец</p>
              <ContactCard contact={tender.contact} workTypes={tender.contact.workTypes.map((w) => w.name)} />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/** Правая колонка по статусу. Форма подачи КП появится на этапе 3. */
function StatusPanel({ status, deadlineAt, plannedStart }: { status: string; deadlineAt: Date | null; plannedStart: string | null }) {
  const box = "rounded-2xl border border-line bg-card p-5";
  if (status === "open") {
    return (
      <div className={box}>
        <p className="flex items-center gap-2 font-medium text-open">
          <CalendarClock size={20} strokeWidth={1.75} /> Идёт приём КП
        </p>
        {deadlineAt && <p className="mt-2">до {formatDateTime(deadlineAt)}</p>}
        <p className="mt-3 text-sm text-muted">
          Скачайте документацию и заполните КП по шаблону (файл с пометкой «Шаблон для КП»). Подача КП на площадке скоро станет доступна.
        </p>
        <p className="mt-3 text-sm text-muted">КП закрыты: суммы и файлы никто не видит до окончания приёма.</p>
      </div>
    );
  }
  if (status === "planned") {
    return (
      <div className={box}>
        <p className="flex items-center gap-2 font-medium text-soon">
          <CalendarClock size={20} strokeWidth={1.75} /> Скоро
        </p>
        <p className="mt-2">Приём КП откроется: {plannedStart || "дата уточняется"}</p>
      </div>
    );
  }
  return (
    <div className={box}>
      <p className="font-medium">Приём завершён</p>
      <p className="mt-2 text-sm text-muted">Итоги направлены участникам.</p>
    </div>
  );
}
