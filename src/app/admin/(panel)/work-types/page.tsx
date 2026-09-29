import { Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/access";
import { ActionForm } from "@/components/ActionForm";
import { btnPrimary, btnSecondary, cardCls, inputCls } from "@/components/ui";
import { deleteWorkType, saveWorkType } from "./actions";

export default async function AdminWorkTypesPage() {
  await requireStaffPage();
  const [workTypes, contacts] = await Promise.all([
    prisma.workType.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { tenders: true } } } }),
    prisma.contact.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);

  const contactSelect = (value: string | null) => (
    <select name="responsibleContactId" defaultValue={value ?? ""} className={inputCls}>
      <option value="">Ответственный не указан</option>
      {contacts.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );

  return (
    <div className="max-w-[900px]">
      <h1 className="font-display text-2xl">Виды работ</h1>
      <p className="mt-2 text-muted">Справочник для тендеров и подписок. Ответственный показывается на странице «Контакты».</p>

      <div className={`${cardCls} mt-6 divide-y divide-line`}>
        {workTypes.map((w) => (
          <div key={w.id} className="flex flex-col gap-2 p-4 md:flex-row md:items-start">
            <ActionForm action={saveWorkType.bind(null, w.id)} className="flex-1">
              <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                <input name="name" defaultValue={w.name} className={inputCls} required aria-label="Название" />
                {contactSelect(w.responsibleContactId)}
                <button className={btnSecondary}>Сохранить</button>
              </div>
            </ActionForm>
            {w._count.tenders === 0 ? (
              <ActionForm action={deleteWorkType.bind(null, w.id)} confirmText={`Удалить «${w.name}»?`}>
                <button className="grid h-11 w-11 place-items-center rounded-[10px] text-muted hover:bg-accent-soft hover:text-accent" title="Удалить">
                  <Trash2 size={18} strokeWidth={1.75} />
                </button>
              </ActionForm>
            ) : (
              <span className="px-2 pt-3 text-xs text-muted md:w-11">Тендеров: {w._count.tenders}</span>
            )}
          </div>
        ))}
      </div>

      <h2 className="mt-8 font-display text-lg">Добавить вид работ</h2>
      <ActionForm action={saveWorkType.bind(null, null)} className={`${cardCls} mt-3 p-4`} resetOnSuccess>
        <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
          <input name="name" className={inputCls} placeholder="Название" required />
          {contactSelect(null)}
          <button className={btnPrimary}>Добавить</button>
        </div>
      </ActionForm>
    </div>
  );
}
