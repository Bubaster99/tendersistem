import type { Project } from "@prisma/client";
import { ActionForm, Field } from "@/components/ActionForm";
import { btnDanger, btnPrimary, btnSecondary, cardCls, inputCls } from "@/components/ui";
import { deleteProject, saveProject } from "./actions";
import Link from "next/link";

export function ProjectForm({ project }: { project?: Project }) {
  return (
    <div className="space-y-4">
      <ActionForm action={saveProject.bind(null, project?.id ?? null)} className={`${cardCls} space-y-4 p-5`}>
        <Field label="Название *">
          <input name="name" className={inputCls} defaultValue={project?.name} required placeholder="ЖК «Северный парк»" />
        </Field>
        <Field label="Адрес">
          <input name="address" className={inputCls} defaultValue={project?.address ?? ""} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Стадия">
            <input name="stage" className={inputCls} defaultValue={project?.stage ?? ""} placeholder="Монолитные работы" />
          </Field>
          <Field label="Срок ввода">
            <input name="finishDate" className={inputCls} defaultValue={project?.finishDate ?? ""} placeholder="IV кв. 2027" />
          </Field>
          <Field label="Этажность / секции">
            <input name="size" className={inputCls} defaultValue={project?.size ?? ""} placeholder="17 этажей, 3 секции" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Картинка (jpg, png, webp до 10 МБ)">
            <input name="coverImage" type="file" accept=".jpg,.jpeg,.png,.webp" className="block w-full text-sm" />
          </Field>
          <Field label="Порядок в списке" hint="Меньше — выше">
            <input name="sortOrder" type="number" className={inputCls} defaultValue={project?.sortOrder ?? 0} />
          </Field>
        </div>
        {project?.coverImage && (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/images/projects/${project.id}?v=${encodeURIComponent(project.coverImage)}`} alt="" className="h-16 w-24 rounded-[10px] object-cover" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="removeCover" className="h-5 w-5 accent-accent" /> Убрать картинку
            </label>
          </div>
        )}
        <label className="flex items-center gap-3">
          <input type="checkbox" name="isPublished" defaultChecked={project?.isPublished ?? true} className="h-5 w-5 accent-accent" />
          Показывать подрядчикам
        </label>
        <div className="flex flex-wrap gap-2 pt-2">
          <button className={btnPrimary}>Сохранить</button>
          <Link href="/admin/projects" className={btnSecondary}>
            Отмена
          </Link>
        </div>
      </ActionForm>
      {project && (
        <ActionForm action={deleteProject.bind(null, project.id)} confirmText="Удалить объект?">
          <button className={btnDanger}>Удалить объект</button>
        </ActionForm>
      )}
    </div>
  );
}
