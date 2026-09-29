import type { Contact, Project, Tender, WorkType } from "@prisma/client";
import { ActionForm, Field } from "@/components/ActionForm";
import { btnPrimary, btnSecondary, cardCls, inputCls, textareaCls } from "@/components/ui";
import { toMoscowInput } from "@/lib/time";
import { saveTender } from "./actions";

type Options = {
  projects: Pick<Project, "id" | "name">[];
  workTypes: Pick<WorkType, "id" | "name">[];
  contacts: Pick<Contact, "id" | "name">[];
};

export function TenderForm({ tender, options }: { tender?: Tender; options: Options }) {
  const isDraft = !tender?.publishedAt;
  const isPlanned = !tender || tender.status === "planned";

  return (
    <ActionForm action={saveTender.bind(null, tender?.id ?? null)} className={`${cardCls} space-y-4 p-5`}>
      <Field label="Название *">
        <input name="title" className={inputCls} defaultValue={tender?.title} required placeholder="Навесной вентилируемый фасад, секции 1–3" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Объект *">
          <select name="projectId" className={inputCls} defaultValue={tender?.projectId ?? ""} required>
            <option value="" disabled>
              Выберите объект
            </option>
            {options.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Вид работ *">
          <select name="workTypeId" className={inputCls} defaultValue={tender?.workTypeId ?? ""} required>
            <option value="" disabled>
              Выберите вид работ
            </option>
            {options.workTypes.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Что нужно сделать" hint="Описание работ — подрядчик увидит его в карточке тендера">
        <textarea name="scope" className={`${textareaCls} min-h-[160px]`} defaultValue={tender?.scope ?? ""} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Приём КП до (время московское)" hint="Обязательно для открытия приёма КП">
          <input name="deadlineAt" type="datetime-local" className={inputCls} defaultValue={toMoscowInput(tender?.deadlineAt)} />
        </Field>
        <Field label="Когда откроется приём" hint="Для «Скоро», текстом: «декабрь 2026»">
          <input name="plannedStart" className={inputCls} defaultValue={tender?.plannedStart ?? ""} />
        </Field>
        <Field label="Начало работ">
          <input name="workStart" className={inputCls} defaultValue={tender?.workStart ?? ""} placeholder="ноябрь 2026" />
        </Field>
        <Field label="Гарантийное удержание, %">
          <input
            name="retentionPercent"
            inputMode="decimal"
            className={inputCls}
            defaultValue={tender?.retentionPercent != null ? String(tender.retentionPercent).replace(".", ",") : ""}
            placeholder="5"
          />
        </Field>
      </div>
      <Field label="Условия оплаты">
        <input name="paymentTerms" className={inputCls} defaultValue={tender?.paymentTerms ?? ""} placeholder="Аванс до 30%, оплата по КС-2 в течение 15 рабочих дней" />
      </Field>
      <Field label="Ответственный снабженец" hint="Если не выбран — подставится ответственный за вид работ">
        <select name="contactId" className={inputCls} defaultValue={tender?.contactId ?? ""}>
          <option value="">По виду работ</option>
          {options.contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        {isDraft ? (
          <button name="intent" value="draft" className={btnSecondary}>
            Сохранить черновик
          </button>
        ) : (
          <button name="intent" value="save" className={btnSecondary}>
            Сохранить
          </button>
        )}
        {isDraft && (
          <button name="intent" value="planned" className={btnSecondary}>
            Опубликовать как «Скоро»
          </button>
        )}
        {isPlanned && (
          <button name="intent" value="open" className={btnPrimary}>
            Открыть приём КП
          </button>
        )}
      </div>
    </ActionForm>
  );
}
