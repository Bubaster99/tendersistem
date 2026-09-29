import "server-only";
import { randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileExtension } from "./files";

// Файлы хранятся на диске нашего сервера (152-ФЗ). Путь — из .env, по умолчанию папка uploads.
function root(): string {
  return path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"));
}

/** Полный путь к файлу по ключу. Ключ не может выйти за пределы папки хранилища. */
export function filePath(key: string): string {
  const base = root();
  const full = path.resolve(base, key);
  if (!full.startsWith(base + path.sep)) throw new Error("Неверный ключ файла");
  return full;
}

/** Сохраняем загруженный файл под случайным именем; исходное имя храним в базе. */
export async function saveUpload(file: File, folder: string): Promise<string> {
  const ext = fileExtension(file.name);
  const key = `${folder}/${randomBytes(16).toString("hex")}${ext ? "." + ext : ""}`;
  const full = filePath(key);
  await mkdir(path.dirname(full), { recursive: true });
  await pipeline(Readable.fromWeb(file.stream() as import("node:stream/web").ReadableStream), createWriteStream(full));
  return key;
}

export async function saveBuffer(data: Buffer, folder: string, ext: string): Promise<string> {
  const key = `${folder}/${randomBytes(16).toString("hex")}.${ext}`;
  const full = filePath(key);
  await mkdir(path.dirname(full), { recursive: true });
  await pipeline(Readable.from([data]), createWriteStream(full));
  return key;
}

export async function removeFile(key: string | null | undefined): Promise<void> {
  if (!key) return;
  await rm(filePath(key), { force: true });
}

export async function fileExists(key: string): Promise<boolean> {
  try {
    return (await stat(filePath(key))).isFile();
  } catch {
    return false;
  }
}

export function readStream(key: string) {
  return createReadStream(filePath(key));
}

/** Поток Node → поток для ответа Next.js. */
export function toWebStream(stream: Readable): ReadableStream<Uint8Array> {
  return Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>;
}
