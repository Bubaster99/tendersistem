"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { saveOnboardingAction, skipOnboardingAction } from "../actions";
import { ActionForm } from "@/components/ActionForm";
import { Chips } from "@/components/Chips";
import { btnPrimary, btnSecondary, cardCls, inputCls } from "@/components/ui";

const MAX = 5;

export function OnboardingForm({ workTypes, defaultRegion }: { workTypes: { id: string; name: string }[]; defaultRegion: string }) {
  // Строки опыта: ключи, чтобы удаление строки не путало введённое.
  const [rows, setRows] = useState<number[]>([0]);
  const [next, setNext] = useState(1);

  return (
    <>
      <ActionForm action={saveOnboardingAction} className="mt-6 flex flex-col gap-4">
        <section className={`${cardCls} p-5`}>
          <h2 className="font-medium">Какие работы выполняете?</h2>
          <p className="mb-3 mt-1 text-sm text-muted">Выберите один или несколько видов.</p>
          <Chips name="workType" options={workTypes} selected={[]} />
        </section>

        <section className={`${cardCls} p-5`}>
          <label className="block">
            <span className="font-medium">Регион работы</span>
            <input name="region" defaultValue={defaultRegion} maxLength={100} placeholder="Москва и Московская область" className={`${inputCls} mt-2`} />
          </label>
        </section>

        <section className={`${cardCls} p-5`}>
          <h2 className="font-medium">Опыт: 1–5 объектов</h2>
          <p className="mt-1 text-sm text-muted">Что вы уже строили — поможет снабжению быстрее с вами познакомиться.</p>
          <div className="mt-3 flex flex-col gap-3">
            {rows.map((key, i) => (
              <div key={key} className="rounded-[12px] border border-line p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-muted">Объект {i + 1}</span>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setRows(rows.filter((r) => r !== key))}
                      className="grid h-9 w-9 place-items-center rounded-[10px] text-muted hover:bg-bg"
                      aria-label="Убрать объект"
                    >
                      <X size={18} strokeWidth={1.75} />
                    </button>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input name={`exp${i}_name`} maxLength={200} placeholder="Название объекта" className={`${inputCls} sm:col-span-2`} />
                  <input name={`exp${i}_year`} inputMode="numeric" maxLength={4} placeholder="Год" className={inputCls} />
                  <input name={`exp${i}_amount`} maxLength={50} placeholder="Сумма, напр. 45 млн ₽" className={inputCls} />
                  <select name={`exp${i}_workType`} defaultValue="" className={`${inputCls} sm:col-span-2`}>
                    <option value="">Вид работ</option>
                    {workTypes.map((w) => (
                      <option key={w.id} value={w.name}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
          {rows.length < MAX && (
            <button
              type="button"
              onClick={() => {
                setRows([...rows, next]);
                setNext(next + 1);
              }}
              className={`${btnSecondary} mt-3`}
            >
              <Plus size={18} strokeWidth={1.75} />
              Добавить объект
            </button>
          )}
        </section>

        <button className={`${btnPrimary} h-12 w-full`}>Сохранить и подписаться</button>
      </ActionForm>

      <form action={skipOnboardingAction} className="mt-3">
        <button className={`${btnSecondary} h-12 w-full`}>Пропустить</button>
      </form>
    </>
  );
}
