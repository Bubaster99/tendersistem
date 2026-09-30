// Правила для загружаемых файлов (раздел 6 SPEC.md). Проверяются на сервере.

export const MB = 1024 * 1024;

/** Документы тендера: pdf, docx, xlsx, zip, dwg до 200 МБ. ВОР — только xlsx. */
export const DOC_EXTENSIONS = ["pdf", "docx", "xlsx", "zip", "dwg"] as const;
export const DOC_MAX_BYTES = 200 * MB;

/** Картинки объектов и фото снабженцев. */
export const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const;
export const IMAGE_MAX_BYTES = 10 * MB;

export function fileExtension(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name.trim());
  return m ? m[1].toLowerCase() : "";
}

export function checkDocument(name: string, size: number, kind: string): string | null {
  const ext = fileExtension(name);
  if (size <= 0) return "Файл пустой";
  if (size > DOC_MAX_BYTES) return "Файл больше 200 МБ";
  if (kind === "bom_template" && ext !== "xlsx") return "ВОР и шаблон КП — только файл Excel (.xlsx)";
  if (!(DOC_EXTENSIONS as readonly string[]).includes(ext)) return "Можно загрузить только pdf, docx, xlsx, zip или dwg";
  return null;
}

export function checkImage(name: string, size: number): string | null {
  const ext = fileExtension(name);
  if (size <= 0) return "Файл пустой";
  if (size > IMAGE_MAX_BYTES) return "Картинка больше 10 МБ";
  if (!(IMAGE_EXTENSIONS as readonly string[]).includes(ext)) return "Картинка — только jpg, png или webp";
  return null;
}

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  zip: "application/zip",
  dwg: "application/acad",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function mimeType(name: string): string {
  return MIME[fileExtension(name)] ?? "application/octet-stream";
}

/** «1,4 МБ», «320 КБ» */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < MB) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / MB).toFixed(1).replace(".", ",")} МБ`;
}

/** Заголовок для скачивания с русским именем файла. */
export function contentDisposition(fileName: string, inline = false): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/** Уникальные имена внутри ZIP: «ТЗ.pdf», «ТЗ (2).pdf». Убираем символы, недопустимые в именах файлов. */
export function uniqueZipNames(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((raw) => {
    const clean = raw.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").trim() || "file";
    const dot = clean.lastIndexOf(".");
    const base = dot > 0 ? clean.slice(0, dot) : clean;
    const ext = dot > 0 ? clean.slice(dot) : "";
    let name = clean;
    for (let i = 2; used.has(name.toLowerCase()); i++) name = `${base} (${i})${ext}`;
    used.add(name.toLowerCase());
    return name;
  });
}
