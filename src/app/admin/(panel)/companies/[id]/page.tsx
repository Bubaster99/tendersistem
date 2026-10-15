import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Star } from "lucide-react";
import { requireStaffPage } from "@/lib/access";
import { COMPANY_STATUS_LABEL, getCompany } from "@/lib/companies";
import { innCheckUrl } from "@/lib/compare";
import { formatDateTime, formatDay } from "@/lib/time";
import { ActionForm, Field } from "@/components/ActionForm";
import { btnPrimary, btnSecondary, cardCls, inputCls, textareaCls } from "@/components/ui";
import { addCompanyNoteAction, updateCompanyAction } from "../actions";

/** Карточка подрядчика: реквизиты, анкета, история участия, статус и рейтинг. */
export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffPage();
  const isAdmin = user.role === "admin";
  const { id } = await params;
  const c = await getCompany(id);
  if (!c) notFound();

  const facts: [string, string | null][] = [
    ["ИНН", c.inn],
    ["КПП", c.kpp],
    ["ОГРН", c.ogrn],
    ["Адрес", c.address],
    ["Город", c.city],
    ["Регион работы", c.region],
    ["Email", c.users.map((u) => u.email).join(", ") || null],
    ["Зарегистрирован", formatDay(c.createdAt)],
    ["Согласие на обработку ПДн", c.users[0]?.consentPdAt ? formatDay(c.users[0].consentPdAt) : null],
  ];

  return (
    <div className="max-w-[860px]">
      <Link href="/admin/companies" className="text-sm text-muted hover:text-ink">
        ← Все подрядчики
      </Link>
      <h1 className="mt-3 font-display text-2xl">{c.name}</h1>
      <a href={innCheckUrl(c.inn)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm text-accent underline">
        Проверить по ИНН <ExternalLink size={14} strokeWidth={1.75} />
      </a>

      <div className={`${cardCls} mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 p-5`}>
        <p>
          <span className="text-muted">Рейтинг: </span>
          {c.rating ? (
            <b className="inline-flex items-center gap-1">
              <Star size={16} strokeWidth={2} /> {c.rating} из 5
            </b>
          ) : (
            "нет"
          )}
        </p>
        {isAdmin ? (
          <ActionForm action={updateCompanyAction.bind(null, c.id)} className="flex flex-wrap items-center gap-2">
            <span className="text-muted">Статус:</span>
            <select name="status" defaultValue={c.status} className={`${inputCls.replace("w-full", "w-auto")} h-10`} aria-label="Статус">
              {Object.entries(COMPANY_STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <button className={`${btnSecondary} h-10 px-3`}>Сохранить</button>
          </ActionForm>
        ) : (
          <p>
            <span className="text-muted">Статус: </span>
            <b>{COMPANY_STATUS_LABEL[c.status]}</b> <span className="text-sm text-muted">(меняет администратор)</span>
          </p>
        )}
        <p className="w-full text-sm text-muted">«Проверен» — в сравнении КП компания помечается «работал с нами». «Заблокирован» — компания не сможет войти на площадку.</p>
      </div>

      <dl className={`${cardCls} mt-5 grid gap-x-6 gap-y-2 p-5 text-sm sm:grid-cols-[220px_1fr]`}>
        {facts.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="break-words">{v || "—"}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-8 font-display text-lg">Анкета</h2>
      <div className={`${cardCls} mt-3 space-y-3 p-5 text-sm`}>
        <p>
          <span className="text-muted">Виды работ: </span>
          {c.workTypeNames.join(", ") || "—"}
        </p>
        <p>
          <span className="text-muted">Подписка: </span>
          {c.subscription?.byEmail && c.subscriptionNames.length ? c.subscriptionNames.join(", ") : "не настроена"}
        </p>
        <div>
          <p className="text-muted">Опыт:</p>
          {c.experienceItems.length === 0 ? (
            <p>—</p>
          ) : (
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {c.experienceItems.map((e, i) => (
                <li key={i}>{[e.name, e.year, e.amount, e.workType].filter(Boolean).join(" · ")}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <h2 className="mt-8 font-display text-lg">Оценки и комментарии</h2>
      <p className="mt-1 text-sm text-muted">Как подрядчик отработал на объекте: оценка от 1 до 5 и пояснение. Последняя оценка — текущий рейтинг компании.</p>
      <ActionForm action={addCompanyNoteAction.bind(null, c.id)} className={`${cardCls} mt-3 space-y-3 p-5`} resetOnSuccess>
        <Field label="Оценка (необязательно)">
          <select name="rating" defaultValue="" className={inputCls.replace("w-full", "w-auto")}>
            <option value="">Без оценки — только комментарий</option>
            {[5, 4, 3, 2, 1].map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Комментарий">
          <textarea name="text" maxLength={2000} rows={3} className={textareaCls} placeholder="Например: сорвали срок монтажа на 2 недели, качество хорошее" />
        </Field>
        <button className={btnPrimary}>Добавить</button>
      </ActionForm>
      <div className={`${cardCls} mt-3 divide-y divide-line`}>
        {c.notes.length === 0 && <p className="p-5 text-muted">Пока нет ни одной записи.</p>}
        {c.notes.map((n) => (
          <div key={n.id} className="p-4 text-sm">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted">
              {n.rating !== null && (
                <b className="inline-flex items-center gap-1 text-ink">
                  <Star size={14} strokeWidth={2} /> {n.rating}
                </b>
              )}
              <span>{formatDateTime(n.createdAt)}</span>
              <span className="break-all">{n.authorEmail}</span>
            </p>
            {n.text && <p className="mt-1 whitespace-pre-line">{n.text}</p>}
          </div>
        ))}
      </div>

      <h2 className="mt-8 font-display text-lg">История участия</h2>
      <div className={`${cardCls} mt-3 divide-y divide-line`}>
        {c.history.length === 0 && <p className="p-5 text-muted">КП пока не подавала.</p>}
        {c.history.map((h) => (
          <div key={h.id} className="flex flex-wrap items-baseline justify-between gap-2 p-4 text-sm">
            <div>
              <Link href={`/admin/tenders/${h.id}`} className="font-medium hover:text-accent">
                {h.title}
              </Link>
              <p className="text-muted">
                {h.project} · КП подано {formatDay(h.at)}
                {h.rebid && " · участвовала в переторжке"}
              </p>
            </div>
            <span className={h.result === "Победитель" ? "font-medium text-open" : "text-muted"}>{h.result}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
