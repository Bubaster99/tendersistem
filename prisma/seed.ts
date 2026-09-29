// Начальные данные. Запускается при каждом старте (npx prisma db seed), повторный запуск ничего не дублирует:
// - справочник видов работ (раздел 3 SPEC.md) и первый администратор — всегда;
// - тестовые объекты, тендеры и контакты — только если в базе ещё нет ни одного объекта.
import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import ExcelJS from "exceljs";
import { PrismaClient, type DocumentKind, type TenderStatus } from "@prisma/client";
import { ensureAdmin } from "./admin";

const prisma = new PrismaClient();

const WORK_TYPES = [
  "Земляные работы",
  "Монолит",
  "Кладка",
  "Фасад",
  "Окна",
  "Кровля",
  "Инженерные сети (ОВиК, ВК)",
  "Электромонтаж",
  "Слаботочные системы",
  "Лифты",
  "Отделка",
  "Благоустройство",
  "Прочее",
];

const uploadRoot = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"));

async function saveFile(folder: string, ext: string, data: Buffer | Uint8Array): Promise<string> {
  const key = `${folder}/${randomBytes(16).toString("hex")}.${ext}`;
  const full = path.join(uploadRoot, key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
  return key;
}

/** Дата через N дней в 18:00 по Москве. */
function daysFromNow(days: number): Date {
  const msk = new Date(Date.now() + 3 * 3600_000 + days * 86400_000);
  return new Date(`${msk.toISOString().slice(0, 10)}T18:00:00+03:00`);
}

/** Простейший PDF-образец (латиница — без встраивания шрифтов). */
function samplePdf(lines: string[]): Buffer {
  const text = lines
    .map((l, i) => `BT /F1 ${i === 0 ? 18 : 12} Tf 72 ${760 - i * 28} Td (${l.replace(/[()\\]/g, "")}) Tj ET`)
    .join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

/** ВОР и шаблон КП в Excel. */
async function sampleBom(title: string, rows: [string, string, number][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("ВОР и КП");
  ws.columns = [{ width: 6 }, { width: 55 }, { width: 10 }, { width: 12 }, { width: 22 }, { width: 22 }];
  ws.addRow([`Ведомость объёмов работ и шаблон КП: ${title}`]).font = { bold: true, size: 13 };
  ws.addRow(["Заполните жёлтые ячейки. Не меняйте строки и столбцы."]);
  ws.addRow([]);
  const head = ws.addRow(["№", "Наименование работ", "Ед. изм.", "Кол-во", "Цена за ед., руб. с НДС", "Сумма, руб. с НДС"]);
  head.font = { bold: true };
  const first = ws.rowCount + 1;
  rows.forEach(([name, unit, qty], i) => {
    const r = ws.addRow([i + 1, name, unit, qty, null, null]);
    r.getCell(6).value = { formula: `D${r.number}*E${r.number}` };
    r.getCell(5).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2B3" } };
  });
  const last = ws.rowCount;
  const total = ws.addRow([null, "ИТОГО с НДС", null, null, null, { formula: `SUM(F${first}:F${last})` }]);
  total.font = { bold: true };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

async function seedWorkTypes() {
  for (const name of WORK_TYPES) {
    await prisma.workType.upsert({ where: { name }, update: {}, create: { name } });
  }
}

async function seedTestData() {
  if ((await prisma.project.count()) > 0) return false;

  const wt = Object.fromEntries((await prisma.workType.findMany()).map((w) => [w.name, w.id]));

  const contactsData = [
    { name: "Ирина Соколова", role: "Руководитель отдела снабжения", scope: "Общие вопросы по тендерам и договорам", phone: "+7 495 100-00-01", email: "sokolova@example.ru", telegram: "sokolova_snab" },
    { name: "Алексей Петров", role: "Ведущий специалист по снабжению", scope: "Коробка здания", phone: "+7 495 100-00-02", email: "petrov@example.ru", telegram: "petrov_snab" },
    { name: "Мария Кузнецова", role: "Специалист по снабжению", scope: "Фасады, окна, кровля", phone: "+7 495 100-00-03", email: "kuznetsova@example.ru", telegram: null },
    { name: "Дмитрий Орлов", role: "Специалист по снабжению", scope: "Инженерные системы", phone: "+7 495 100-00-04", email: "orlov@example.ru", telegram: "orlov_snab" },
    { name: "Ольга Смирнова", role: "Специалист по снабжению", scope: "Отделка и благоустройство", phone: "+7 495 100-00-05", email: "smirnova@example.ru", telegram: null },
  ];
  const contacts = [];
  for (const [i, c] of contactsData.entries()) contacts.push(await prisma.contact.create({ data: { ...c, sortOrder: i } }));
  const [sokolova, petrov, kuznetsova, orlov, smirnova] = contacts;

  const responsible: Record<string, string> = {
    "Земляные работы": petrov.id,
    Монолит: petrov.id,
    Кладка: petrov.id,
    Фасад: kuznetsova.id,
    Окна: kuznetsova.id,
    Кровля: kuznetsova.id,
    "Инженерные сети (ОВиК, ВК)": orlov.id,
    Электромонтаж: orlov.id,
    "Слаботочные системы": orlov.id,
    Лифты: orlov.id,
    Отделка: smirnova.id,
    Благоустройство: smirnova.id,
    Прочее: sokolova.id,
  };
  for (const [name, contactId] of Object.entries(responsible)) {
    await prisma.workType.update({ where: { name }, data: { responsibleContactId: contactId } });
  }

  const [north, river, linden] = await Promise.all([
    prisma.project.create({ data: { name: "ЖК «Северный парк»", address: "г. Москва, ул. Лесная, 12", stage: "Монолитные работы", finishDate: "IV кв. 2027", size: "17 этажей, 3 секции", sortOrder: 1, isPublished: true } }),
    prisma.project.create({ data: { name: "ЖК «Речной квартал»", address: "Московская обл., г. Химки, Набережная ул., 5", stage: "Котлован", finishDate: "II кв. 2028", size: "25 этажей, 2 секции", sortOrder: 2, isPublished: true } }),
    prisma.project.create({ data: { name: "ЖК «Липовая роща»", address: "г. Москва, пос. Коммунарка, Липовая ул., 3", stage: "Отделочные работы", finishDate: "II кв. 2027", size: "9 этажей, 4 секции", sortOrder: 3, isPublished: true } }),
  ]);

  type T = {
    projectId: string;
    workType: string;
    title: string;
    status: TenderStatus;
    deadlineDays?: number;
    plannedStart?: string;
    workStart: string;
    scope: string;
    bom?: [string, string, number][];
  };
  const payment = "Аванс до 30%, оплата по КС-2/КС-3 в течение 15 рабочих дней";
  const tenders: T[] = [
    { projectId: north.id, workType: "Фасад", title: "Навесной вентилируемый фасад, секции 1–3", status: "open", deadlineDays: 12, workStart: "ноябрь 2026", scope: "Монтаж подсистемы и облицовки керамогранитом, утепление минераловатными плитами 150 мм, откосы и отливы.\nМатериалы подрядчика. Проект НВФ — в документации.", bom: [["Монтаж подсистемы НВФ", "м²", 8400], ["Утепление минплитой 150 мм", "м²", 8400], ["Облицовка керамогранитом", "м²", 7900], ["Откосы и отливы", "п.м", 3200]] },
    { projectId: north.id, workType: "Окна", title: "Поставка и монтаж оконных блоков ПВХ", status: "open", deadlineDays: 6, workStart: "декабрь 2026", scope: "Поставка и монтаж оконных и балконных блоков ПВХ, подоконники, монтажный шов по ГОСТ 30971.", bom: [["Оконные блоки ПВХ", "м²", 2600], ["Балконные двери ПВХ", "шт", 310], ["Подоконники", "п.м", 1450]] },
    { projectId: north.id, workType: "Кровля", title: "Плоская кровля, секции 1–3", status: "planned", plannedStart: "январь 2027", workStart: "март 2027", scope: "Устройство плоской кровли с наплавляемой гидроизоляцией и утеплением, парапеты, воронки." },
    { projectId: north.id, workType: "Монолит", title: "Монолитный каркас, секция 3", status: "awarded", deadlineDays: -40, workStart: "август 2026", scope: "Устройство монолитного каркаса секции 3: фундаментная плита, стены, перекрытия, лестницы." },
    { projectId: north.id, workType: "Электромонтаж", title: "Внутреннее электроснабжение и освещение", status: "planned", plannedStart: "декабрь 2026", workStart: "февраль 2027", scope: "Этажные щиты, стояки, квартирная разводка, освещение МОП." },
    { projectId: river.id, workType: "Земляные работы", title: "Разработка котлована и вывоз грунта", status: "closed", deadlineDays: -10, workStart: "октябрь 2026", scope: "Разработка котлована с погрузкой и вывозом грунта, водоотлив, обратная засыпка пазух." },
    { projectId: river.id, workType: "Монолит", title: "Монолитный каркас, секции 1–2", status: "open", deadlineDays: 20, workStart: "январь 2027", scope: "Фундаментная плита, монолитные стены и перекрытия секций 1–2, 25 этажей. Бетон и арматура — поставка заказчика.", bom: [["Фундаментная плита", "м³", 5200], ["Стены и пилоны", "м³", 14800], ["Перекрытия", "м³", 16300], ["Лестничные марши", "м³", 640]] },
    { projectId: river.id, workType: "Инженерные сети (ОВиК, ВК)", title: "Отопление, водоснабжение и канализация", status: "planned", plannedStart: "февраль 2027", workStart: "май 2027", scope: "Внутренние системы отопления, ХВС/ГВС и канализации, ИТП." },
    { projectId: linden.id, workType: "Отделка", title: "Отделка мест общего пользования", status: "open", deadlineDays: 9, workStart: "ноябрь 2026", scope: "Чистовая отделка МОП: холлы, коридоры, лестничные клетки. Дизайн-проект — в документации.", bom: [["Штукатурка стен", "м²", 12600], ["Окраска стен", "м²", 12600], ["Керамогранит на пол", "м²", 4100], ["Подвесной потолок", "м²", 3800]] },
    { projectId: linden.id, workType: "Благоустройство", title: "Благоустройство двора и детские площадки", status: "closed", deadlineDays: -3, workStart: "апрель 2027", scope: "Покрытия, озеленение, МАФ, детские и спортивные площадки." },
  ];

  const now = Date.now();
  for (const [i, t] of tenders.entries()) {
    const created = await prisma.tender.create({
      data: {
        projectId: t.projectId,
        workTypeId: wt[t.workType],
        title: t.title,
        scope: t.scope,
        status: t.status,
        plannedStart: t.plannedStart ?? null,
        deadlineAt: t.deadlineDays !== undefined ? daysFromNow(t.deadlineDays) : null,
        workStart: t.workStart,
        paymentTerms: payment,
        retentionPercent: 5,
        contactId: responsible[t.workType],
        publishedAt: new Date(now - (30 - i) * 86400_000),
      },
    });

    const docs: { kind: DocumentKind; fileName: string; ext: string; data: Buffer }[] = [];
    if (t.bom) docs.push({ kind: "bom_template", fileName: `ВОР и шаблон КП — ${t.workType}.xlsx`, ext: "xlsx", data: await sampleBom(t.title, t.bom) });
    if (t.status !== "planned") {
      docs.push({ kind: "tz", fileName: "Техническое задание.pdf", ext: "pdf", data: samplePdf(["Tekhnicheskoe zadanie (obrazets)", "Testovyi dokument dlya proverki skachivaniya.", `Tender ID: ${created.id}`]) });
      docs.push({ kind: "contract", fileName: "Проект договора подряда.pdf", ext: "pdf", data: samplePdf(["Proekt dogovora podryada (obrazets)", "Testovyi dokument dlya proverki skachivaniya."]) });
    }
    for (const d of docs) {
      const fileKey = await saveFile(`tenders/${created.id}`, d.ext, d.data);
      await prisma.tenderDocument.create({ data: { tenderId: created.id, kind: d.kind, fileKey, fileName: d.fileName, size: d.data.length } });
    }
  }
  return true;
}

async function main() {
  await seedWorkTypes();
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) console.log(await ensureAdmin(prisma, adminEmail));
  if (await seedTestData()) console.log("Тестовые данные созданы: 3 объекта, 10 тендеров, 5 контактов");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
