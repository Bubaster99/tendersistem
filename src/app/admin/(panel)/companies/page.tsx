import Link from "next/link";
import { FileSpreadsheet, Star } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/access";
import { COMPANY_STATUS_LABEL, listCompanies, type CompanyFilter } from "@/lib/companies";
import { formatDay } from "@/lib/time";
import { btnPrimary, btnSecondary, cardCls, inputCls } from "@/components/ui";

export const metadata = { title: "Подрядчики — Снабжение" };

const STATUS_STYLE = { new: "bg-soon-bg text-soon", checked: "bg-open-bg text-open", blocked: "bg-accent-soft text-accent" } as const;

/** Реестр подрядчиков (раздел 5.5). */
export default async function CompaniesPage({ searchParams }: { searchParams: Promise<CompanyFilter> }) {
  await requireStaffPage();
  const f = await searchParams;
  const [rows, workTypes] = await Promise.all([
    listCompanies(f),
    prisma.workType.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => typeof v === "string" && v) as [string, string][]).toString();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl">Подрядчики</h1>
        <a href={`/api/companies/export${qs ? `?${qs}` : ""}`} className={btnSecondary}>
          <FileSpreadsheet size={18} strokeWidth={1.75} /> Скачать в Excel
        </a>
      </div>
      <p className="mt-2 text-muted">Все зарегистрированные компании. Статус и рейтинг меняются в карточке компании.</p>

      <form className={`${cardCls} mt-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_170px_150px_auto]`}>
        <input name="q" defaultValue={f.q ?? ""} placeholder="Название или ИНН" className={inputCls} aria-label="Поиск" />
        <select name="workType" defaultValue={f.workType ?? ""} className={inputCls} aria-label="Вид работ">
          <option value="">Все виды работ</option>
          {workTypes.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={f.status ?? ""} className={inputCls} aria-label="Статус">
          <option value="">Любой статус</option>
          {Object.entries(COMPANY_STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select name="rating" defaultValue={f.rating ?? ""} className={inputCls} aria-label="Рейтинг">
          <option value="">Любой рейтинг</option>
          {[5, 4, 3, 2, 1].map((r) => (
            <option key={r} value={r}>
              {r === 5 ? "5" : `${r} и выше`}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <button className={btnPrimary}>Найти</button>
          <Link href="/admin/companies" className={btnSecondary}>
            Сбросить
          </Link>
        </div>
      </form>

      <p className="mt-4 text-sm text-muted">Найдено: {rows.length}</p>
      <div className={`${cardCls} mt-2 overflow-x-auto`}>
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="px-4 py-3 font-normal">Компания</th>
              <th className="px-4 py-3 font-normal">Виды работ</th>
              <th className="px-4 py-3 font-normal">Статус</th>
              <th className="px-4 py-3 font-normal">Рейтинг</th>
              <th className="px-4 py-3 font-normal" title="В скольких тендерах подавала КП / сколько выиграла">
                Участие
              </th>
              <th className="px-4 py-3 font-normal">С нами с</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-5 text-muted">
                  Никого не нашли.
                </td>
              </tr>
            )}
            {rows.map((c) => (
              <tr key={c.id} className="align-top hover:bg-bg">
                <td className="px-4 py-3">
                  <Link href={`/admin/companies/${c.id}`} className="font-medium hover:text-accent">
                    {c.name}
                  </Link>
                  <p className="text-muted">
                    ИНН {c.inn}
                    {c.city ? ` · ${c.city}` : ""}
                  </p>
                </td>
                <td className="max-w-[260px] px-4 py-3 text-muted">{c.workTypes.join(", ") || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[c.status]}`}>{COMPANY_STATUS_LABEL[c.status]}</span>
                </td>
                <td className="px-4 py-3">
                  {c.rating ? (
                    <span className="inline-flex items-center gap-1">
                      <Star size={14} strokeWidth={2} /> {c.rating}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {c.tenders} тенд. · {c.wins} побед
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted">{formatDay(c.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
