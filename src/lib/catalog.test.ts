import { describe, expect, it } from "vitest";
import { formatDay, parseMoscowInput, toMoscowInput } from "./time";
import { checkDocument, checkImage, contentDisposition, uniqueZipNames } from "./files";
import { isTenderVisible, sortForContractor, tenderGroup, termLine } from "./tenders";

describe("Московское время", () => {
  it("поле формы читается как время по Москве", () => {
    const d = parseMoscowInput("2026-10-12T18:00");
    expect(d?.toISOString()).toBe("2026-10-12T15:00:00.000Z");
    expect(toMoscowInput(d)).toBe("2026-10-12T18:00");
  });

  it("отбрасывает мусор и несуществующие даты", () => {
    expect(parseMoscowInput("")).toBeNull();
    expect(parseMoscowInput("12.10.2026")).toBeNull();
    expect(parseMoscowInput("2026-02-31T10:00")).toBeNull();
  });

  it("дата около полуночи попадает в правильный день", () => {
    // 21:30 UTC — это уже 00:30 следующего дня по Москве.
    expect(formatDay(new Date("2026-10-11T21:30:00Z"), new Date("2026-10-01T00:00:00Z"))).toBe("12 октября");
  });
});

describe("Файлы", () => {
  it("документы тендера: только pdf, docx, xlsx, zip, dwg до 200 МБ", () => {
    expect(checkDocument("ТЗ.pdf", 1000, "tz")).toBeNull();
    expect(checkDocument("Чертежи.DWG", 1000, "drawings")).toBeNull();
    expect(checkDocument("вирус.exe", 1000, "other")).not.toBeNull();
    expect(checkDocument("big.pdf", 201 * 1024 * 1024, "tz")).not.toBeNull();
    expect(checkDocument("empty.pdf", 0, "tz")).not.toBeNull();
  });

  it("ВОР и шаблон КП — только xlsx", () => {
    expect(checkDocument("ВОР.xlsx", 1000, "bom_template")).toBeNull();
    expect(checkDocument("ВОР.pdf", 1000, "bom_template")).not.toBeNull();
  });

  it("картинки — jpg, png, webp до 10 МБ", () => {
    expect(checkImage("фасад.JPG", 1000)).toBeNull();
    expect(checkImage("фасад.svg", 1000)).not.toBeNull();
    expect(checkImage("фасад.png", 11 * 1024 * 1024)).not.toBeNull();
  });

  it("имена в архиве не повторяются и не содержат путей", () => {
    expect(uniqueZipNames(["ТЗ.pdf", "тз.pdf", "../a/b.pdf"])).toEqual(["ТЗ.pdf", "тз (2).pdf", ".._a_b.pdf"]);
  });

  it("русское имя файла при скачивании", () => {
    expect(contentDisposition("ТЗ.pdf")).toContain("filename*=UTF-8''%D0%A2%D0%97.pdf");
  });
});

describe("Тендеры для подрядчика", () => {
  const base = { publishedAt: new Date(), status: "open" as const, project: { isPublished: true } };

  it("не видны черновики, отменённые и тендеры скрытых объектов", () => {
    expect(isTenderVisible(base)).toBe(true);
    expect(isTenderVisible({ ...base, publishedAt: null })).toBe(false);
    expect(isTenderVisible({ ...base, status: "cancelled" })).toBe(false);
    expect(isTenderVisible({ ...base, project: { isPublished: false } })).toBe(false);
  });

  it("группы: open → «Нужны сейчас», planned → «Скоро», остальное → «Завершённые»", () => {
    expect(tenderGroup("open")).toBe("open");
    expect(tenderGroup("planned")).toBe("planned");
    expect(tenderGroup("closed")).toBe("done");
    expect(tenderGroup("rebid")).toBe("done");
    expect(tenderGroup("awarded")).toBe("done");
    expect(tenderGroup("cancelled")).toBeNull();
  });

  it("сортировка: open → planned → завершённые, открытые — по ближайшему дедлайну", () => {
    const t = (id: string, status: "open" | "planned" | "closed", deadline?: string) => ({
      id,
      status,
      deadlineAt: deadline ? new Date(deadline) : null,
      createdAt: new Date("2026-01-01"),
    });
    const sorted = sortForContractor([t("c", "closed"), t("p", "planned"), t("o2", "open", "2026-12-01"), t("o1", "open", "2026-11-01")]);
    expect(sorted.map((x) => x.id)).toEqual(["o1", "o2", "p", "c"]);
  });

  it("строка срока", () => {
    const now = new Date("2026-09-29T12:00:00Z");
    expect(termLine({ status: "open", deadlineAt: new Date("2026-10-12T15:00:00Z"), plannedStart: null }, now)).toBe("Приём до 12 октября");
    expect(termLine({ status: "planned", deadlineAt: null, plannedStart: "декабрь 2026" }, now)).toBe("Старт: декабрь 2026");
    expect(termLine({ status: "closed", deadlineAt: null, plannedStart: null }, now)).toBe("Приём завершён");
  });
});
