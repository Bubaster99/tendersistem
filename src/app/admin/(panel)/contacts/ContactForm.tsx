import Link from "next/link";
import type { Contact } from "@prisma/client";
import { ActionForm, Field } from "@/components/ActionForm";
import { btnDanger, btnPrimary, btnSecondary, cardCls, inputCls, textareaCls } from "@/components/ui";
import { deleteContact, saveContact } from "./actions";

export function ContactForm({ contact }: { contact?: Contact }) {
  return (
    <div className="space-y-4">
      <ActionForm action={saveContact.bind(null, contact?.id ?? null)} className={`${cardCls} space-y-4 p-5`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ФИО *">
            <input name="name" className={inputCls} defaultValue={contact?.name} required />
          </Field>
          <Field label="Должность">
            <input name="role" className={inputCls} defaultValue={contact?.role ?? ""} placeholder="Ведущий специалист по снабжению" />
          </Field>
        </div>
        <Field label="За что отвечает" hint="Виды работ из справочника подставятся сами, если человек там указан ответственным">
          <textarea name="scope" className={textareaCls} defaultValue={contact?.scope ?? ""} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Телефон">
            <input name="phone" type="tel" className={inputCls} defaultValue={contact?.phone ?? ""} placeholder="+7 900 000-00-00" />
          </Field>
          <Field label="Email">
            <input name="email" type="email" className={inputCls} defaultValue={contact?.email ?? ""} />
          </Field>
          <Field label="Telegram" hint="Имя без @">
            <input name="telegram" className={inputCls} defaultValue={contact?.telegram ?? ""} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Фото (jpg, png, webp до 10 МБ)">
            <input name="photo" type="file" accept=".jpg,.jpeg,.png,.webp" className="block w-full text-sm" />
          </Field>
          <Field label="Порядок в списке" hint="Меньше — выше">
            <input name="sortOrder" type="number" className={inputCls} defaultValue={contact?.sortOrder ?? 0} />
          </Field>
        </div>
        {contact?.photo && (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/images/contacts/${contact.id}?v=${encodeURIComponent(contact.photo)}`} alt="" className="h-16 w-16 rounded-full object-cover" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="removePhoto" className="h-5 w-5 accent-accent" /> Убрать фото
            </label>
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-2">
          <button className={btnPrimary}>Сохранить</button>
          <Link href="/admin/contacts" className={btnSecondary}>
            Отмена
          </Link>
        </div>
      </ActionForm>
      {contact && (
        <ActionForm action={deleteContact.bind(null, contact.id)} confirmText="Удалить контакт?">
          <button className={btnDanger}>Удалить контакт</button>
        </ActionForm>
      )}
    </div>
  );
}
