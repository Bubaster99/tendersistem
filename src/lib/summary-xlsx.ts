import "server-only";
// «Скачать сводную в Excel» (раздел 5.3): та же сравнительная таблица, оба раунда.
import ExcelJS from "exceljs";
import { budgetDeltaPct, compareBids } from "./compare";
import type { StaffBid } from "./bids";
import { formatDateTime } from "./time";

const n = (v: { toString(): string } | null | undefined) => (v == null ? null : Number(String(v)));

export async function buildSummaryXlsx(input: {
  title: string;
  projectName: string;
  workTypeName: string;
  deadlineAt: Date | null;
  rebidDeadlineAt: Date | null;
  budget: number | null;
  round1: StaffBid[];
  round2: StaffBid[];
  winnerCompanyId: string | null;
}): Promise<Buffer> {
  const cmp = compareBids(input.round1, input.round2);
  const hasRebid = input.rebidDeadlineAt !== null;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Сводная");
  ws.addRow([input.title]).font = { bold: true, size: 14 };
  ws.addRow([`${input.projectName} · ${input.workTypeName}`]);
  if (input.deadlineAt) ws.addRow([`Окончание приёма КП: ${formatDateTime(input.deadlineAt)}`]);
  if (input.rebidDeadlineAt) ws.addRow([`Окончание переторжки: ${formatDateTime(input.rebidDeadlineAt)}`]);
  ws.addRow([]);
  const facts: [string, number | string | null][] = [
    ["Лучшая цена, ₽", cmp.best],
    ["Бюджет, ₽", input.budget],
    ["Лучшая к бюджету, %", cmp.best !== null ? budgetDeltaPct(cmp.best, input.budget) : null],
    ["Разброс цен, %", cmp.spreadPct],
    ["Участников", cmp.rows.length],
  ];
  for (const [k, v] of facts) {
    const r = ws.addRow([k, v ?? "—"]);
    r.getCell(1).font = { bold: true };
    if (typeof v === "number" && k.includes("₽")) r.getCell(2).numFmt = "#,##0.00";
  }
  ws.addRow([]);

  const header = [
    "№",
    "Участник",
    "ИНН",
    "Метка",
    "Рейтинг",
    ...(hasRebid ? ["Сумма раунд 1, ₽", "Сумма раунд 2, ₽"] : []),
    "Итог с НДС, ₽",
    "От лучшей, %",
    "Срок, дн.",
    "Аванс, %",
    "Комментарий",
    "Подано",
    "Итог",
  ];
  const hr = ws.addRow(header);
  hr.font = { bold: true };
  hr.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFECEAE6" } };
    c.alignment = { vertical: "middle", wrapText: true };
  });

  cmp.rows.forEach((row, i) => {
    const b = row.final;
    const r = ws.addRow([
      i + 1,
      b.company.name,
      b.company.inn,
      b.company.workedWithUs ? "работал с нами" : "новый",
      b.company.rating ?? "",
      ...(hasRebid ? [n(row.r1?.totalWithVat), n(row.r2?.totalWithVat)] : []),
      row.total,
      row.deviationPct,
      b.durationDays,
      n(b.advancePercent),
      b.comment ?? "",
      formatDateTime(b.replacedAt ?? b.submittedAt),
      input.winnerCompanyId === row.companyId ? "Победитель" : "",
    ]);
    const moneyCols = hasRebid ? [6, 7, 8] : [6];
    for (const c of moneyCols) r.getCell(c).numFmt = "#,##0.00";
    r.alignment = { vertical: "top", wrapText: true };
  });

  const widths = [5, 34, 14, 16, 9, ...(hasRebid ? [18, 18] : []), 18, 12, 10, 10, 40, 22, 12];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  return Buffer.from(await wb.xlsx.writeBuffer());
}
