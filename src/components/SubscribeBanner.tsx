"use client";

import { Bell } from "lucide-react";

export const OPEN_SUBSCRIPTION_EVENT = "open-subscription";

/** Баннер «Не пропускайте новые тендеры» — открывает панель подписки в шапке. */
export function SubscribeBanner() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-dark p-5 text-white sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Bell size={22} strokeWidth={1.5} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">Не пропускайте новые тендеры</p>
          <p className="text-sm text-white/70">Выберите виды работ — пришлём письмо, когда откроется приём КП.</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event(OPEN_SUBSCRIPTION_EVENT))}
        className="h-11 shrink-0 rounded-[10px] bg-accent px-5 font-medium text-white hover:opacity-90"
      >
        Настроить подписку
      </button>
    </div>
  );
}
