import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, ExternalLink, FileSpreadsheet, FileText, Lock, Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/access";
import { closeExpiredTenders, staffTenderBids, type StaffBids } from "@/lib/bids";
import { formatMoney, formatPercent } from "@/lib/bid-rules";
import { clientIp } from "@/lib/request-ip";
import { formatDateTime } from "@/lib/time";
import { ActionForm, Field } from "@/components/ActionForm";
import { AdminStatusBadge } from "@/components/StatusBadge";
import { btnDanger, btnPrimary, cardCls, inputCls } from "@/components/ui";
import { formatSize } from "@/lib/files";
import { DOCUMENT_KIND_LABEL, DOCUMENT_KIND_ORDER, isTenderVisible } from "@/lib/tenders";
import { TenderForm } from "../TenderForm";
import { tenderFormOptions } from "../options";
import { deleteDocument, deleteTender, uploadDocument } from "../actions";

export default async function EditTenderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const user = await requireStaffPage();
  const { id } = await params;
  const { created } = await searchParams;
  await closeExpiredTenders();
  const [tender, options] = await Promise.all([
    prisma.tender.findUnique({
      where: { id },
      include: { documents: true, project: { select: { isPublished: true } }, _count: { select: { downloads: true } } },
    }),
    tenderFormOptions(),
  ]);
  if (!tender) notFound();
  // До дедлайна — только количество; после — список, просмотр пишется в журнал.
  const bids = tender.publishedAt ? await staffTenderBids(user, tender.id, await clientIp()) : null;

  const docs = [...tender.documents].sort(
    (a, b) => DOCUMENT_KIND_ORDER.indexOf(a.kind) - DOCUMENT_KIND_ORDER.indexOf(b.kind) || a.uploadedAt.getTime() - b.uploadedAt.getTime(),
  );
  const visible = isTenderVisible(tender);

  return (
    <div className="max-w-[860px]">
      <Link href="/admin/tenders" className="text-sm text-muted hover:text-ink">
        ← Все тендеры
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl">{tender.title}</h1>
        <AdminStatusBadge status={tender.status} published={!!tender.publishedAt} />
      </div>
      <p className="mt-2 text-sm text-muted">
        Скачали документацию: {tender._count.downloads}
        {visible ? (
          <>
            {" · "}
            <Link href={`/tenders/${tender.id}`} className="inline-flex items-center gap-1 text-accent underline">
              Как видят подрядчики <ExternalLink size={14} strokeWidth={1.75} />
            </Link>
          </>
        ) : (
          " · Подрядчики пока не видят этот тендер" + (tender.publishedAt && !tender.project.isPublished ? " (объект скрыт)" : "")
        )}
      </p>
      {created && <p className="mt-4 rounded-[10px] bg-open-bg px-4 py-3 text-sm text-open">Тендер сохранён. Теперь загрузите документы.</p>}

      {bids && <BidsSection bids={bids} />}

      <div className="mt-6">
        <TenderForm tender={tender} options={options} />
      </div>

      <h2 className="mt-10 font-display text-lg">Документация</h2>
      <div className={`${cardCls} mt-3 divide-y divide-line`}>
        {docs.length === 0 && <p className="p-4 text-muted">Документов пока нет.</p>}
        {docs.map((d) => (
          <div key={d.id} className="flex items-center gap-3 p-4">
            <FileText size={20} strokeWidth={1.5} className="shrink-0 text-muted" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium" title={d.fileName}>
                {d.fileName}
              </p>
              <p className="text-sm text-muted">
                {DOCUMENT_KIND_LABEL[d.kind]} · {formatSize(d.size)}
              </p>
            </div>
            <a href={`/api/documents/${d.id}`} className="grid h-11 w-11 place-items-center rounded-[10px] text-muted hover:bg-bg" title="Скачать">
              <Download size={18} strokeWidth={1.75} />
            </a>
            <ActionForm action={deleteDocument.bind(null, d.id)} confirmText={`Удалить «${d.fileName}»?`}>
              <button className="grid h-11 w-11 place-items-center rounded-[10px] text-muted hover:bg-accent-soft hover:text-accent" title="Удалить">
                <Trash2 size={18} strokeWidth={1.75} />
              </button>
            </ActionForm>
          </div>
        ))}
      </div>

      <ActionForm action={uploadDocument.bind(null, tender.id)} className={`${cardCls} mt-4 space-y-4 p-5`} resetOnSuccess>
        <p className="font-medium">Загрузить документ</p>
        <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
          <Field label="Тип">
            <select name="kind" className={inputCls} defaultValue="bom_template">
              {DOCUMENT_KIND_ORDER.map((k) => (
                <option key={k} value={k}>
                  {DOCUMENT_KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Файл" hint="pdf, docx, xlsx, zip, dwg — до 200 МБ. ВОР и шаблон КП — только .xlsx, новый заменяет старый.">
            <input name="file" type="file" required accept=".pdf,.docx,.xlsx,.zip,.dwg" className="block w-full py-2 text-sm" />
          </Field>
        </div>
        <button className={btnPrimary}>Загрузить</button>
      </ActionForm>

      {!tender.publishedAt && (
        <ActionForm action={deleteTender.bind(null, tender.id)} confirmText="Удалить черновик тендера вместе с документами?" className="mt-8">
          <button className={btnDanger}>Удалить черновик</button>
        </ActionForm>
      )}
    </div>
  );
}

/** КП участников. Сравнительная таблица, переторжка и выбор победителя — этап 5. */
function BidsSection({ bids }: { bids: StaffBids }) {
  if (bids.sealed) {
    return (
      <div className={`${cardCls} mt-6 flex gap-3 p-5`}>
        <Lock size={20} strokeWidth={1.75} className="mt-0.5 shrink-0 text-muted" />
        <div>
          <p className="font-medium">Подано КП: {bids.count}</p>
          <p className="mt-1 text-sm text-muted">
            Суммы и файлы КП закрыты до окончания приёма{bids.deadlineAt ? ` — ${formatDateTime(bids.deadlineAt)}` : ""}. Их не видит никто, включая администратора.
          </p>
        </div>
      </div>
    );
  }
  return (
    <section className="mt-6">
      <h2 className="font-display text-lg">
        КП участников <span className="text-muted">{bids.count}</span>
      </h2>
      <p className="mt-1 text-sm text-muted">Приём завершён, КП вскрыты. Каждый просмотр и скачивание записываются в журнал.</p>
      <div className={`${cardCls} mt-3 divide-y divide-line`}>
        {bids.bids.length === 0 && <p className="p-4 text-muted">КП не подавали.</p>}
        {bids.bids.map((b) => (
          <div key={b.id} className="p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium">
                {b.company.name} <span className="text-sm font-normal text-muted">ИНН {b.company.inn}</span>
              </p>
              <p className="font-display text-lg">{formatMoney(b.totalWithVat)}</p>
            </div>
            <p className="mt-1 text-sm text-muted">
              Срок: {b.durationDays} дн. · Аванс: {formatPercent(b.advancePercent)} · Подано: {formatDateTime(b.replacedAt ?? b.submittedAt)}
              {b.versions > 0 && ` · замен: ${b.versions}`}
            </p>
            {b.comment && <p className="mt-2 whitespace-pre-line text-sm">{b.comment}</p>}
            <a href={`/api/bids/${b.id}/file`} className="mt-2 inline-flex items-center gap-2 text-sm text-accent underline underline-offset-2">
              <FileSpreadsheet size={16} strokeWidth={1.75} /> {b.fileName} · {formatSize(b.fileSize)}
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
