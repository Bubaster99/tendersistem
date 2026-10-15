import Link from "next/link";
import { requireAdminPage } from "@/lib/access";
import { ACTION_GROUPS, readJournal } from "@/lib/journal";
import { formatDateTime } from "@/lib/time";
import { btnPrimary, btnSecondary, cardCls, inputCls } from "@/components/ui";

export const metadata = { title: "Журнал действий — Снабжение" };

type Search = { group?: string; q?: string; from?: string; to?: string; page?: string };

/** Журнал действий: только для администратора (раздел 2 SPEC.md). */
export default async function JournalPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const data = await readJournal({ ...sp, page: Number(sp.page) || 1 });
  const link = (page: number) => `/admin/journal?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => v)), page: String(page) })}`;

  return (
    <div>
      <h1 className="font-display text-2xl">Журнал действий</h1>
      <p className="mt-2 text-muted">Кто, когда и что сделал: входы, подача, просмотр и скачивание КП, смена статусов тендеров, выбор победителя. Записи нельзя изменить или удалить.</p>

      <form className={`${cardCls} mt-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1.2fr_160px_160px_auto]`}>
        <select name="group" defaultValue={sp.group ?? ""} className={inputCls} aria-label="Тип действия">
          <option value="">Все действия</option>
          {ACTION_GROUPS.map((g) => (
            <option key={g.key} value={g.key}>
              {g.label}
            </option>
          ))}
        </select>
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Email или текст, например ИНН" className={inputCls} aria-label="Поиск" />
        <input name="from" type="date" defaultValue={sp.from ?? ""} className={inputCls} aria-label="С даты" />
        <input name="to" type="date" defaultValue={sp.to ?? ""} className={inputCls} aria-label="По дату" />
        <div className="flex gap-2">
          <button className={btnPrimary}>Показать</button>
          <Link href="/admin/journal" className={btnSecondary}>
            Сбросить
          </Link>
        </div>
      </form>

      <p className="mt-4 text-sm text-muted">Найдено записей: {data.total}</p>
      <div className={`${cardCls} mt-2 overflow-x-auto`}>
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="px-4 py-3 font-normal">Когда</th>
              <th className="px-4 py-3 font-normal">Кто</th>
              <th className="px-4 py-3 font-normal">Действие</th>
              <th className="px-4 py-3 font-normal">Подробности</th>
              <th className="px-4 py-3 font-normal">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-5 text-muted">
                  Записей нет.
                </td>
              </tr>
            )}
            {data.rows.map((r) => (
              <tr key={r.id} className="align-top">
                <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(r.at)}</td>
                <td className="px-4 py-3 break-all">{r.who}</td>
                <td className="px-4 py-3 whitespace-nowrap">{r.action}</td>
                <td className="px-4 py-3">
                  {r.tender && (
                    <Link href={`/admin/tenders/${r.tender.id}`} className="block text-accent underline underline-offset-2">
                      {r.tender.title}
                    </Link>
                  )}
                  <span className="text-muted">{r.details}</span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted">{r.ip ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.pages > 1 && (
        <div className="mt-4 flex items-center gap-3 text-sm">
          {data.page > 1 && (
            <Link href={link(data.page - 1)} className={btnSecondary}>
              ← Новее
            </Link>
          )}
          <span className="text-muted">
            Страница {data.page} из {data.pages}
          </span>
          {data.page < data.pages && (
            <Link href={link(data.page + 1)} className={btnSecondary}>
              Старше →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
