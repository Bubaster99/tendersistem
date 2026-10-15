"use client";

import { Mail, Send } from "lucide-react";
import { saveSubscriptionAction } from "@/app/(app)/actions";
import { ActionForm } from "./ActionForm";
import { Chips } from "./Chips";
import { btnPrimary } from "./ui";

export type SubscriptionPanelData = {
  workTypes: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  current: { workTypeIds: string[]; projectIds: string[]; byEmail: boolean } | null;
};

/** Содержимое выезжающей панели «Подписка» (раздел 4.9). */
export function SubscriptionPanel({ data, onSaved }: { data: SubscriptionPanelData | null; onSaved: () => void }) {
  if (!data) return <p className="mt-4 text-muted">Подписка доступна подрядчикам.</p>;
  const cur = data.current;
  return (
    <ActionForm action={saveSubscriptionAction} onSuccess={() => setTimeout(onSaved, 900)} className="mt-4 flex flex-col gap-6">
      <p className="text-sm text-muted">Пришлём письмо, когда откроется приём КП по выбранным видам работ.</p>

      <section>
        <h3 className="mb-2.5 font-medium">Виды работ</h3>
        <Chips name="workType" options={data.workTypes} selected={cur?.workTypeIds ?? []} />
      </section>

      <section>
        <h3 className="mb-2.5 font-medium">Объекты</h3>
        <Chips name="project" options={data.projects} selected={cur?.projectIds ?? []} emptyHint="Ничего не выбрано — все объекты, в том числе новые" />
      </section>

      <section>
        <h3 className="mb-2.5 font-medium">Куда присылать</h3>
        <label className="flex cursor-pointer items-center gap-3 rounded-[10px] border border-line px-4 py-3">
          <input type="checkbox" name="byEmail" defaultChecked={cur?.byEmail ?? true} className="h-5 w-5 shrink-0 accent-accent" />
          <Mail size={18} strokeWidth={1.75} className="text-muted" />
          <span>Email</span>
        </label>
        <div className="mt-2 flex items-center gap-3 rounded-[10px] border border-line px-4 py-3 text-muted">
          <input type="checkbox" disabled className="h-5 w-5 shrink-0" />
          <Send size={18} strokeWidth={1.75} />
          <span>Telegram — скоро</span>
        </div>
      </section>

      <button className={`${btnPrimary} w-full`}>Сохранить</button>
    </ActionForm>
  );
}
