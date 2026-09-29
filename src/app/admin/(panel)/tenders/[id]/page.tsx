import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, ExternalLink, FileText, Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/access";
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
  await requireStaffPage();
  const { id } = await params;
  const { created } = await searchParams;
  const [tender, options] = await Promise.all([
    prisma.tender.findUnique({
      where: { id },
      include: { documents: true, project: { select: { isPublished: true } }, _count: { select: { downloads: true } } },
    }),
    tenderFormOptions(),
  ]);
  if (!tender) notFound();

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
