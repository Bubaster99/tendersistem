"use client";

// Сравнительная таблица КП после дедлайна (раздел 5.3 SPEC.md): сводка, таблица, переторжка, выбор победителя.
import { useState } from "react";
import { Award, ExternalLink, FileSpreadsheet, Lock, Repeat, Star } from "lucide-react";
import { ActionForm, Field } from "@/components/ActionForm";
import { btnPrimary, btnSecondary, cardCls, inputCls, textareaCls } from "@/components/ui";
import { chooseWinnerAction, saveBudgetAction, startRebidAction } from "./award-actions";

export type BidCell = { id: string; total: string; fileName: string; fileSize: string; submittedAt: string; versions: number };

export type CompareRowView = {
  companyId: string;
  name: string;
  inn: string;
  innUrl: string;
  workedWithUs: boolean;
  rating: number | null;
  invited: boolean;
  r1: BidCell | null;
  r2: BidCell | null;
  total: string; // итоговое предложение
  deviation: string; // «+4,2%» / «лучшая»
  durationDays: number;
  advance: string;
  comment: string | null;
};

export type ComparisonView = {
  tenderId: string;
  status: "closed" | "rebid" | "awarded" | string;
  rows: CompareRowView[];
  best: string | null;
  budget: string | null;
  budgetRaw: string;
  bestVsBudget: string | null;
  spread: string | null;
  canRebid: boolean;
  canChooseWinner: boolean;
  rebid: { deadline: string; invited: number; sealed: boolean; count: number } | null;
  winnerName: string | null;
  defaultDocuments: string;
};

export function Comparison({ v }: { v: ComparisonView }) {
  const [mode, setMode] = useState<"none" | "rebid" | "winner">("none");
  const [picked, setPicked] = useState<string[]>([]);
  const hasRound2 = v.rebid !== null;
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg">
          Сравнение КП <span className="text-muted">{v.rows.length}</span>
        </h2>
        <a href={`/api/tenders/${v.tenderId}/summary`} className={btnSecondary}>
          <FileSpreadsheet size={18} strokeWidth={1.75} /> Скачать сводную в Excel
        </a>
      </div>
      <p className="mt-1 text-sm text-muted">Приём завершён, КП вскрыты. Каждый просмотр и скачивание записываются в журнал.</p>

      {v.winnerName && (
        <p className="mt-4 flex items-center gap-2 rounded-[10px] bg-open-bg px-4 py-3 text-open">
          <Award size={18} strokeWidth={1.75} /> Победитель: <b>{v.winnerName}</b>. Итоги отправлены участникам.
        </p>
      )}
      {v.rebid && (
        <div className="mt-4 flex gap-3 rounded-[10px] bg-soon-bg px-4 py-3 text-soon">
          {v.rebid.sealed ? <Lock size={18} strokeWidth={1.75} className="mt-0.5 shrink-0" /> : <Repeat size={18} strokeWidth={1.75} className="mt-0.5 shrink-0" />}
          <p className="text-sm">
            {v.rebid.sealed
              ? `Идёт переторжка до ${v.rebid.deadline}. Приглашено: ${v.rebid.invited}, подали КП: ${v.rebid.count}. Суммы раунда 2 откроются после этого срока.`
              : `Переторжка завершена ${v.rebid.deadline}. Подали КП на переторжку: ${v.rebid.count} из ${v.rebid.invited}.`}
          </p>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Tile k="Лучшая цена" v={v.best ?? "—"} />
        <div className={`${cardCls} px-4 py-3`}>
          <p className="text-xs text-muted">Бюджет</p>
          <ActionForm action={saveBudgetAction.bind(null, v.tenderId)} className="mt-1 flex gap-2">
            <input name="budget" defaultValue={v.budgetRaw} placeholder="не задан" inputMode="decimal" className={`${inputCls} h-10`} aria-label="Бюджет, ₽" />
            <button className={`${btnSecondary} h-10 px-3`}>OK</button>
          </ActionForm>
          {v.bestVsBudget && <p className="mt-1 text-xs text-muted">Лучшая цена к бюджету: {v.bestVsBudget}</p>}
        </div>
        <Tile k="Разброс цен" v={v.spread ?? "—"} hint="насколько самая высокая цена выше самой низкой" />
      </div>

      {v.rows.length === 0 ? (
        <p className={`${cardCls} mt-4 p-5 text-muted`}>КП не подавали.</p>
      ) : (
        <div className={`${cardCls} mt-4 overflow-x-auto`}>
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                {mode === "rebid" && <th className="w-10 px-3 py-3" />}
                <th className="px-3 py-3 font-normal">Участник</th>
                {hasRound2 && <th className="px-3 py-3 font-normal">Раунд 1</th>}
                {hasRound2 && <th className="px-3 py-3 font-normal">Раунд 2</th>}
                <th className="px-3 py-3 font-normal">Итог с НДС</th>
                <th className="px-3 py-3 font-normal">От лучшей</th>
                <th className="px-3 py-3 font-normal">Срок</th>
                <th className="px-3 py-3 font-normal">Аванс</th>
                <th className="px-3 py-3 font-normal">Комментарий</th>
                <th className="px-3 py-3 font-normal">Файл</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {v.rows.map((r, i) => {
                const file = r.r2 ?? r.r1;
                return (
                  <tr key={r.companyId} className={i === 0 ? "bg-open-bg/40" : ""}>
                    {mode === "rebid" && (
                      <td className="px-3 py-3 align-top">
                        <input
                          type="checkbox"
                          checked={picked.includes(r.companyId)}
                          onChange={() => toggle(r.companyId)}
                          className="h-5 w-5 accent-accent"
                          aria-label={`Пригласить ${r.name}`}
                        />
                      </td>
                    )}
                    <td className="px-3 py-3 align-top">
                      <p className="font-medium">{r.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                        <span className={`rounded-full px-2 py-0.5 ${r.workedWithUs ? "bg-open-bg text-open" : "bg-soon-bg text-soon"}`}>
                          {r.workedWithUs ? "работал с нами" : "новый"}
                        </span>
                        {r.rating !== null && (
                          <span className="inline-flex items-center gap-0.5 text-muted" title="Рейтинг">
                            <Star size={12} strokeWidth={2} /> {r.rating}
                          </span>
                        )}
                        {r.invited && <span className="rounded-full bg-closed-bg px-2 py-0.5 text-closed">переторжка</span>}
                      </div>
                      <a href={r.innUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-accent underline">
                        ИНН {r.inn} — проверить <ExternalLink size={12} strokeWidth={1.75} />
                      </a>
                    </td>
                    {hasRound2 && <td className="px-3 py-3 align-top whitespace-nowrap">{r.r1?.total ?? "—"}</td>}
                    {hasRound2 && <td className="px-3 py-3 align-top whitespace-nowrap">{r.r2?.total ?? (!r.invited ? "—" : v.rebid?.sealed ? "запечатано" : "не подано")}</td>}
                    <td className="px-3 py-3 align-top font-medium whitespace-nowrap">{r.total}</td>
                    <td className={`px-3 py-3 align-top whitespace-nowrap ${i === 0 ? "text-open" : ""}`}>{r.deviation}</td>
                    <td className="px-3 py-3 align-top whitespace-nowrap">{r.durationDays} дн.</td>
                    <td className="px-3 py-3 align-top">{r.advance}</td>
                    <td className="max-w-[220px] px-3 py-3 align-top whitespace-pre-line text-muted">{r.comment || "—"}</td>
                    <td className="px-3 py-3 align-top">
                      {file && (
                        <a href={`/api/bids/${file.id}/file`} className="inline-flex items-center gap-1.5 text-accent underline underline-offset-2" title={file.fileName}>
                          <FileSpreadsheet size={16} strokeWidth={1.75} /> {file.fileSize}
                        </a>
                      )}
                      <p className="mt-1 text-xs text-muted">{file?.submittedAt}</p>
                      {r.r2 && r.r1 && (
                        <a href={`/api/bids/${r.r1.id}/file`} className="mt-1 block text-xs text-muted underline">
                          файл раунда 1
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(v.canRebid || v.canChooseWinner) && mode === "none" && (
        <div className="mt-4 flex flex-wrap gap-3">
          {v.canRebid && (
            <button type="button" onClick={() => setMode("rebid")} className={btnSecondary}>
              <Repeat size={18} strokeWidth={1.75} /> Переторжка с отмеченными
            </button>
          )}
          {v.canChooseWinner && (
            <button type="button" onClick={() => setMode("winner")} className={btnPrimary}>
              <Award size={18} strokeWidth={1.75} /> Выбрать победителя
            </button>
          )}
        </div>
      )}

      {mode === "rebid" && (
        <ActionForm action={startRebidAction.bind(null, v.tenderId)} className={`${cardCls} mt-4 space-y-4 p-5`} confirmText="Начать переторжку? Приглашённым уйдут письма.">
          <p className="font-medium">Переторжка (раунд 2)</p>
          <p className="text-sm text-muted">Отметьте участников галочками в таблице и укажите срок. Остальные участники увидят «Приём завершён».</p>
          {picked.map((id) => (
            <input key={id} type="hidden" name="company" value={id} />
          ))}
          <p className="text-sm">Отмечено: {picked.length}</p>
          <Field label="Новый срок подачи КП (мск)">
            <input name="rebidDeadline" type="datetime-local" required className={`${inputCls} max-w-[280px]`} />
          </Field>
          <div className="flex flex-wrap gap-3">
            <button className={btnPrimary} disabled={picked.length === 0}>
              Начать переторжку и отправить приглашения
            </button>
            <button type="button" onClick={() => setMode("none")} className={btnSecondary}>
              Отмена
            </button>
          </div>
        </ActionForm>
      )}

      {mode === "winner" && (
        <ActionForm action={chooseWinnerAction.bind(null, v.tenderId)} className={`${cardCls} mt-4 space-y-4 p-5`} confirmText="Выбрать победителя? Письма уйдут всем участникам, отменить будет нельзя.">
          <p className="font-medium">Выбор победителя</p>
          <div className="space-y-2">
            {v.rows.map((r, i) => (
              <label key={r.companyId} className="flex cursor-pointer items-center gap-3 rounded-[10px] border border-line px-4 py-3 hover:bg-bg">
                <input type="radio" name="winner" value={r.companyId} defaultChecked={i === 0} className="h-5 w-5 shrink-0 accent-accent" />
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{r.name}</span>
                  <span className="block text-sm text-muted">
                    {r.total} · {r.deviation}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <Field label="Документы, которые запросим у победителя (каждый с новой строки)">
            <textarea name="documents" defaultValue={v.defaultDocuments} className={textareaCls} rows={7} />
          </Field>
          <p className="text-sm text-muted">Победителю уйдёт письмо с этим списком, остальным участникам — «Выбран другой участник, спасибо за участие».</p>
          <div className="flex flex-wrap gap-3">
            <button className={btnPrimary}>Подтвердить и отправить письма</button>
            <button type="button" onClick={() => setMode("none")} className={btnSecondary}>
              Отмена
            </button>
          </div>
        </ActionForm>
      )}
    </section>
  );
}

function Tile({ k, v, hint }: { k: string; v: string; hint?: string }) {
  return (
    <div className={`${cardCls} px-4 py-3`}>
      <p className="text-xs text-muted">{k}</p>
      <p className="mt-1 font-display text-lg">{v}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
