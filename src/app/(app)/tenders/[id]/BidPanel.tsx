"use client";

import { useState } from "react";
import { CalendarClock, CheckCircle2, Download, FileSpreadsheet, Lock, Paperclip } from "lucide-react";
import { ActionForm, Field } from "@/components/ActionForm";
import { btnPrimary, btnSecondary, inputCls, textareaCls } from "@/components/ui";
import { submitBidAction } from "./actions";

const MAX_BYTES = 20 * 1024 * 1024;
const box = "rounded-2xl border border-line bg-card p-5";

export type OwnBidView = {
  id: string;
  fileName: string;
  fileSize: string;
  total: string;
  durationDays: number;
  advance: string;
  advanceRaw: string;
  totalRaw: string;
  comment: string | null;
  submittedAt: string;
  replacedAt: string | null;
  versions: number;
};

/** Правая колонка открытого тендера: форма КП или «КП принято» с заменой. */
export function BidPanel({
  tenderId,
  deadline,
  bomDocId,
  bid,
}: {
  tenderId: string;
  deadline: string;
  bomDocId: string | null;
  bid: OwnBidView | null;
}) {
  const [replacing, setReplacing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  if (bid && !replacing) {
    return (
      <div className={box}>
        <p className="flex items-center gap-2 font-medium text-open">
          <CheckCircle2 size={20} strokeWidth={1.75} /> КП принято
        </p>
        {notice && <p className="mt-3 rounded-[10px] bg-open-bg px-4 py-3 text-sm text-open">{notice}</p>}
        <a href={`/api/bids/${bid.id}/file`} className="-mx-2 mt-3 flex items-center gap-3 rounded-[10px] px-2 py-2 hover:bg-bg">
          <FileSpreadsheet size={22} strokeWidth={1.5} className="shrink-0 text-muted" />
          <span className="min-w-0 flex-1">
            <span className="block break-words font-medium">{bid.fileName}</span>
            <span className="block text-sm text-muted">{bid.fileSize}</span>
          </span>
          <Download size={18} strokeWidth={1.75} className="shrink-0 text-muted" />
        </a>
        <dl className="mt-3 space-y-2 text-sm">
          <Row k="Итого с НДС" v={bid.total} />
          <Row k="Срок" v={`${bid.durationDays} дн.`} />
          <Row k="Аванс" v={bid.advance} />
          <Row k="Подано" v={bid.submittedAt} />
          {bid.replacedAt && <Row k="Заменено" v={bid.replacedAt} />}
          {bid.versions > 0 && <Row k="Прежних версий" v={String(bid.versions)} />}
        </dl>
        {bid.comment && <p className="mt-3 whitespace-pre-line text-sm text-muted">{bid.comment}</p>}
        <button type="button" onClick={() => { setNotice(null); setReplacing(true); }} className={`${btnSecondary} mt-4 w-full`}>
          Заменить КП
        </button>
        <p className="mt-3 text-sm text-muted">Заменить КП можно до {deadline}. Прежняя версия сохранится в истории.</p>
        <Sealed deadline={deadline} />
      </div>
    );
  }

  return (
    <div className={box}>
      <p className="flex items-center gap-2 font-medium text-open">
        <CalendarClock size={20} strokeWidth={1.75} /> {bid ? "Замена КП" : "Подать КП"}
      </p>
      <p className="mt-1 text-sm">Приём до {deadline}</p>

      <ol className="mt-4 space-y-2 text-sm">
        <Step n={1}>
          Скачайте{" "}
          {bomDocId ? (
            <a href={`/api/documents/${bomDocId}`} className="text-accent underline underline-offset-2">
              шаблон КП
            </a>
          ) : (
            "шаблон КП"
          )}{" "}
          (ВОР) из документации.
        </Step>
        <Step n={2}>Заполните цены в Excel и сохраните файл в формате .xlsx.</Step>
        <Step n={3}>Загрузите файл и укажите итог, срок и аванс.</Step>
      </ol>

      <ActionForm
        action={submitBidAction.bind(null, tenderId)}
        className="mt-4 space-y-3"
        resetOnSuccess
        onSuccess={(m) => {
          setNotice(m ?? null);
          setFileName(null);
          setReplacing(false);
        }}
      >
        <div>
          <span className="mb-1.5 block text-sm text-muted">Файл КП (.xlsx, до 20 МБ) *</span>
          <label className={`${btnPrimary} h-12 w-full cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/40`}>
            <Paperclip size={18} strokeWidth={1.75} /> {fileName ? "Выбрать другой файл" : "Прикрепить файл КП"}
            <input
              name="file"
              type="file"
              required
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => {
                const f = e.currentTarget.files?.[0];
                if (f && f.size > MAX_BYTES) {
                  alert("Файл больше 20 МБ. Уменьшите его и загрузите снова.");
                  e.currentTarget.value = "";
                  setFileName(null);
                  return;
                }
                setFileName(f?.name ?? null);
              }}
            />
          </label>
          <p className={`mt-1.5 flex items-center gap-1.5 text-sm ${fileName ? "text-ink" : "text-muted"}`}>
            {fileName ? (
              <>
                <FileSpreadsheet size={16} strokeWidth={1.75} className="shrink-0 text-muted" />
                <span className="break-all">{fileName}</span>
              </>
            ) : (
              "Файл не выбран"
            )}
          </p>
        </div>
        <Field label="Итого с НДС, ₽ *">
          <input name="totalWithVat" inputMode="decimal" required className={inputCls} placeholder="12 500 000,00" defaultValue={bid?.totalRaw} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Срок, дней *">
            <input name="durationDays" inputMode="numeric" required className={inputCls} placeholder="90" defaultValue={bid?.durationDays} />
          </Field>
          <Field label="Аванс, % *">
            <input name="advancePercent" inputMode="decimal" required className={inputCls} placeholder="0" defaultValue={bid?.advanceRaw} />
          </Field>
        </div>
        <Field label="Комментарий">
          <textarea name="comment" maxLength={2000} className={`${textareaCls} min-h-[90px]`} defaultValue={bid?.comment ?? ""} />
        </Field>
        <button className={`${btnPrimary} h-12 w-full`}>{bid ? "Заменить КП" : "Отправить КП"}</button>
        {bid && (
          <button type="button" onClick={() => setReplacing(false)} className={`${btnSecondary} w-full`}>
            Отмена
          </button>
        )}
      </ActionForm>
      <Sealed deadline={deadline} />
    </div>
  );
}

function Sealed({ deadline }: { deadline: string }) {
  return (
    <p className="mt-4 flex gap-2 rounded-[10px] bg-bg px-3 py-2.5 text-sm text-muted">
      <Lock size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
      <span>КП закрыты: до окончания приёма ({deadline}) суммы и файлы не видит никто — ни снабжение, ни другие участники.</span>
    </p>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-medium text-accent">{n}</span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}
