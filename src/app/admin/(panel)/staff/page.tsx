import { Trash2 } from "lucide-react";
import { requireAdminPage } from "@/lib/access";
import { listStaff, STAFF_ROLE_LABEL } from "@/lib/staff";
import { formatDay } from "@/lib/time";
import { ActionForm, Field } from "@/components/ActionForm";
import { btnPrimary, btnSecondary, cardCls, inputCls } from "@/components/ui";
import { addStaffAction, removeStaffAction, setStaffRoleAction } from "./actions";

export const metadata = { title: "Сотрудники — Снабжение" };

/** Сотрудники (раздел 5.6): только для администратора. */
export default async function StaffPage() {
  const me = await requireAdminPage();
  const staff = await listStaff();

  return (
    <div className="max-w-[860px]">
      <h1 className="font-display text-2xl">Сотрудники</h1>
      <p className="mt-2 text-muted">
        Снабженцы работают с тендерами и подрядчиками. Администратор вдобавок управляет сотрудниками и видит журнал действий. Вход — по email и коду, пароля нет.
      </p>

      <div className={`${cardCls} mt-6 divide-y divide-line`}>
        {staff.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="break-all font-medium">
                {s.email} {s.id === me.id && <span className="text-sm font-normal text-muted">(это вы)</span>}
              </p>
              <p className="text-sm text-muted">
                {[s.name, `добавлен ${formatDay(s.createdAt)}`].filter(Boolean).join(" · ")}
              </p>
            </div>
            {s.id === me.id ? (
              <span className="text-sm text-muted">{STAFF_ROLE_LABEL[s.role as "buyer" | "admin"]}</span>
            ) : (
              <>
                <ActionForm action={setStaffRoleAction.bind(null, s.id)} className="flex gap-2">
                  <select name="role" defaultValue={s.role} className={`${inputCls} h-10 w-auto`} aria-label="Роль">
                    <option value="buyer">{STAFF_ROLE_LABEL.buyer}</option>
                    <option value="admin">{STAFF_ROLE_LABEL.admin}</option>
                  </select>
                  <button className={`${btnSecondary} h-10 px-3`}>Сохранить</button>
                </ActionForm>
                <ActionForm action={removeStaffAction.bind(null, s.id)} confirmText={`Удалить сотрудника ${s.email}? Доступ в админку закроется сразу.`}>
                  <button className="grid h-10 w-10 place-items-center rounded-[10px] text-muted hover:bg-accent-soft hover:text-accent" title="Удалить">
                    <Trash2 size={18} strokeWidth={1.75} />
                  </button>
                </ActionForm>
              </>
            )}
          </div>
        ))}
      </div>

      <ActionForm action={addStaffAction} className={`${cardCls} mt-6 space-y-4 p-5`} resetOnSuccess>
        <p className="font-medium">Добавить сотрудника</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Email *">
            <input name="email" type="email" required className={inputCls} placeholder="name@company.ru" />
          </Field>
          <Field label="ФИО">
            <input name="name" className={inputCls} />
          </Field>
          <Field label="Роль">
            <select name="role" defaultValue="buyer" className={inputCls}>
              <option value="buyer">{STAFF_ROLE_LABEL.buyer}</option>
              <option value="admin">{STAFF_ROLE_LABEL.admin}</option>
            </select>
          </Field>
        </div>
        <button className={btnPrimary}>Добавить</button>
      </ActionForm>
    </div>
  );
}
