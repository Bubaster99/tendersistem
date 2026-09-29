// Разбор полей формы на сервере.

/** Строка без пробелов по краям; пусто → null. Длина ограничена. */
export function str(fd: FormData, name: string, max = 500): string | null {
  const v = fd.get(name);
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t === "" ? null : t;
}

export function int(fd: FormData, name: string, fallback = 0): number {
  const n = Number.parseInt(String(fd.get(name) ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

export function bool(fd: FormData, name: string): boolean {
  const v = fd.get(name);
  return v === "on" || v === "true" || v === "1";
}

/** Загруженный файл или null, если поле пустое. */
export function file(fd: FormData, name: string): File | null {
  const v = fd.get(name);
  return v instanceof File && v.size > 0 && v.name ? v : null;
}

/** «5», «5,5», «5.5» → 5.5; пусто → null; ошибка → NaN. */
export function decimal(fd: FormData, name: string): number | null {
  const v = str(fd, name, 20);
  if (v === null) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : Number.NaN;
}
