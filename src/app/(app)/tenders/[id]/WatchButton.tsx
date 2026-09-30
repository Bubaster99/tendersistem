"use client";

import { BellRing } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { btnPrimary, btnSecondary } from "@/components/ui";
import { watchAction } from "./actions";

/** «Сообщить о старте» для тендера «Скоро». Письма о старте — этап 4. */
export function WatchButton({ tenderId, watching }: { tenderId: string; watching: boolean }) {
  if (watching) {
    return (
      <ActionForm action={watchAction.bind(null, tenderId, false)} className="mt-4">
        <p className="flex items-center gap-2 rounded-[10px] bg-soon-bg px-3 py-2.5 text-sm text-soon">
          <BellRing size={18} strokeWidth={1.75} className="shrink-0" /> Сообщим на почту, когда откроется приём КП
        </p>
        <button className={`${btnSecondary} mt-3 w-full`}>Не сообщать</button>
      </ActionForm>
    );
  }
  return (
    <ActionForm action={watchAction.bind(null, tenderId, true)} className="mt-4">
      <button className={`${btnPrimary} w-full`}>
        <BellRing size={18} strokeWidth={1.75} /> Сообщить о старте
      </button>
    </ActionForm>
  );
}
