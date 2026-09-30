"use client";

// Чипсы — плашки с множественным выбором. Выбранная — залита фирменным цветом и с галочкой.
// Выбор хранится в состоянии страницы, в форму уходят скрытые поля — так подсветка работает в любом браузере.
import { useState } from "react";
import { Check } from "lucide-react";

export function Chips({
  name,
  options,
  selected,
  emptyHint,
}: {
  name: string;
  options: { id: string; name: string }[];
  selected: string[];
  emptyHint?: string; // что значит «ничего не выбрано»
}) {
  const [picked, setPicked] = useState<string[]>(() => selected.filter((id) => options.some((o) => o.id === id)));
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = picked.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(o.id)}
              className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 py-2 text-sm ${
                on ? "border-accent bg-accent font-medium text-white" : "border-line bg-card text-ink hover:border-ink"
              }`}
            >
              {on && <Check size={16} strokeWidth={2.25} />}
              {o.name}
            </button>
          );
        })}
      </div>
      {picked.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
      <p className="mt-2 text-sm text-muted">{picked.length > 0 ? `Выбрано: ${picked.length}` : (emptyHint ?? "Ничего не выбрано")}</p>
    </div>
  );
}
