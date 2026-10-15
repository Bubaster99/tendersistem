import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { requireStaffPage } from "@/lib/access";
import { COMPANY_STATUS_LABEL, getCompany } from "@/lib/companies";
import { innCheckUrl } from "@/lib/compare";
import { formatDay } from "@/lib/time";
import { ActionForm, Field } from "@/components/ActionForm";
import { btnPrimary, cardCls, inputCls } from "@/components/ui";
import { updateCompanyAction } from "../actions";

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

      {isAdmin ? (
        <ActionForm action={updateCompanyAction.bind(null, c.id)} className={`${cardCls} mt-5 flex flex-wrap items-end gap-4 p-5`}>
          <Field label="Статус">
            <select name="status" defaultValue={c.status} className={`${inputCls} w-auto`}>
              {Object.entries(COMPANY_STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Рейтинг (после работ)">
            <select name="rating" defaultValue={c.rating ?? ""} className={`${inputCls} w-auto`}>
              <option value="">Нет</option>
              {[1, 2, 3, 4, 5].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
          <button className={btnPrimary}>Сохранить</button>
          <p className="w-full text-sm text-muted">«Проверен» — в сравнении КП компания помечается «работал с нами». «Заблокирован» — компания не сможет войти на площадку.</p>
        </ActionForm>
      ) : (
        <p className={`${cardCls} mt-5 p-5 text-sm`}>
          Статус: <b>{COMPANY_STATUS_LABEL[c.status]}</b> · Рейтинг: <b>{c.rating ?? "нет"}</b>
          <span className="mt-1 block text-muted">Статус и рейтинг меняет администратор.</span>
        </p>
      )}

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
