// Сравнительная таблица КП (раздел 5.3 SPEC.md). Чистые функции — покрыты тестами.

type Priced = { companyId: string; totalWithVat: { toString(): string } };

export type CompareRow<B extends Priced> = {
  companyId: string;
  r1: B | null; // основной раунд
  r2: B | null; // переторжка
  final: B; // итоговое предложение: переторжка, если подано, иначе основной раунд
  total: number;
  deviationPct: number; // отклонение от лучшей цены, %
};

export type Comparison<B extends Priced> = {
  rows: CompareRow<B>[]; // по возрастанию итоговой суммы
  best: number | null;
  worst: number | null;
  spreadPct: number | null; // разброс: насколько самая высокая цена выше самой низкой, %
};

const num = (v: { toString(): string }) => Number(String(v));
const round1 = (v: number) => Math.round(v * 10) / 10;

export function compareBids<B extends Priced>(round1Bids: B[], round2Bids: B[] = []): Comparison<B> {
  const byCompany = new Map<string, { r1: B | null; r2: B | null }>();
  for (const b of round1Bids) byCompany.set(b.companyId, { r1: b, r2: null });
  for (const b of round2Bids) byCompany.set(b.companyId, { r1: byCompany.get(b.companyId)?.r1 ?? null, r2: b });

  const rows = [...byCompany.entries()].map(([companyId, { r1, r2 }]) => {
    const final = (r2 ?? r1)!;
    return { companyId, r1, r2, final, total: num(final.totalWithVat), deviationPct: 0 };
  });
  rows.sort((a, b) => a.total - b.total);
  if (rows.length === 0) return { rows, best: null, worst: null, spreadPct: null };

  const best = rows[0].total;
  const worst = rows[rows.length - 1].total;
  for (const r of rows) r.deviationPct = best > 0 ? round1(((r.total - best) / best) * 100) : 0;
  return { rows, best, worst, spreadPct: best > 0 ? round1(((worst - best) / best) * 100) : null };
}

/** Разница с бюджетом, %: отрицательная — дешевле бюджета. */
export function budgetDeltaPct(price: number, budget: number | null): number | null {
  if (budget === null || budget <= 0) return null;
  return round1(((price - budget) / budget) * 100);
}

/** Список документов победителю по умолчанию (поле можно поправить перед отправкой). */
export const DEFAULT_WINNER_DOCUMENTS = [
  "Устав",
  "Выписка из ЕГРЮЛ (не старше 30 дней)",
  "Решение или приказ о назначении директора",
  "Выписка из реестра членов СРО",
  "Карточка предприятия с банковскими реквизитами",
  "Бухгалтерский баланс за последний год",
];

/** Ссылка «Проверить по ИНН» — карточка компании на Rusprofile. */
export function innCheckUrl(inn: string): string {
  return `https://www.rusprofile.ru/search?query=${encodeURIComponent(inn)}`;
}
