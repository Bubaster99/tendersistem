// Чипсы — плашки с множественным выбором. Под капотом обычные галочки, поэтому работают в любой форме.

export function Chips({
  name,
  options,
  selected,
}: {
  name: string;
  options: { id: string; name: string }[];
  selected: string[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label key={o.id} className="cursor-pointer">
          <input type="checkbox" name={name} value={o.id} defaultChecked={selected.includes(o.id)} className="peer sr-only" />
          <span className="inline-flex min-h-10 items-center rounded-full border border-line bg-card px-4 py-2 text-sm transition hover:bg-bg peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40">
            {o.name}
          </span>
        </label>
      ))}
    </div>
  );
}
