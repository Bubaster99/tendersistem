// Общие стили элементов (раздел 10 SPEC.md: радиусы 10–16 px, кнопки 44–54 px).

export const inputCls =
  "h-11 w-full rounded-[10px] border border-line bg-card px-3 text-base outline-none focus:border-ink disabled:bg-bg disabled:text-muted";
export const textareaCls =
  "min-h-[120px] w-full rounded-[10px] border border-line bg-card px-3 py-2.5 text-base outline-none focus:border-ink";
export const btnPrimary =
  "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-accent px-5 font-medium text-white transition hover:opacity-90 disabled:opacity-50";
export const btnSecondary =
  "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-line bg-card px-5 font-medium text-ink transition hover:bg-bg disabled:opacity-50";
export const btnDanger =
  "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] px-4 text-accent transition hover:bg-accent-soft disabled:opacity-50";
export const cardCls = "rounded-2xl border border-line bg-card";
