// Время на площадке — московское (UTC+3, без перехода на летнее время).

const TZ = "Europe/Moscow";
const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;

/** «2026-10-12T18:00» из поля формы → момент времени по Москве. null — пусто или ошибка. */
export function parseMoscowInput(value: string | null | undefined): Date | null {
  const v = String(value ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(v);
  if (!m) return null;
  const d = new Date(`${v}:00+03:00`);
  if (Number.isNaN(d.getTime())) return null;
  // Отсекаем несуществующие даты вроде 31 февраля.
  if (toMoscowInput(d) !== v) return null;
  return d;
}

/** Момент времени → значение для поля <input type="datetime-local"> по Москве. */
export function toMoscowInput(d: Date | null | undefined): string {
  if (!d) return "";
  return new Date(d.getTime() + MSK_OFFSET_MS).toISOString().slice(0, 16);
}

const dayMonth = new Intl.DateTimeFormat("ru-RU", { timeZone: TZ, day: "numeric", month: "long" });
const dayMonthYear = new Intl.DateTimeFormat("ru-RU", { timeZone: TZ, day: "numeric", month: "long", year: "numeric" });
const hourMinute = new Intl.DateTimeFormat("ru-RU", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const year = new Intl.DateTimeFormat("ru-RU", { timeZone: TZ, year: "numeric" });

/** «12 октября» (год добавляется, если он не текущий). */
export function formatDay(d: Date, now: Date = new Date()): string {
  return year.format(d) === year.format(now) ? dayMonth.format(d) : dayMonthYear.format(d).replace(/\s*г\.$/, "");
}

/** «12 октября, 18:00 (мск)» */
export function formatDateTime(d: Date, now: Date = new Date()): string {
  return `${formatDay(d, now)}, ${hourMinute.format(d)} (мск)`;
}
