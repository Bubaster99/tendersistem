import { PassThrough } from "node:stream";
import { ZipArchive } from "archiver";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { canDownload, NO_STORE, trackDownload } from "@/lib/downloads";
import { contentDisposition, uniqueZipNames } from "@/lib/files";
import { fileExists, filePath, toWebStream } from "@/lib/storage";
import { DOCUMENT_KIND_ORDER } from "@/lib/tenders";

// «Скачать всё одним архивом»: ZIP собирается на лету, ничего не сохраняется на диск.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Нужно войти", { status: 401, headers: NO_STORE });

  const { id } = await params;
  const tender = await prisma.tender.findUnique({
    where: { id },
    include: { documents: true, project: { select: { isPublished: true } } },
  });
  if (!tender || !canDownload(user, tender)) return new Response("Не найдено", { status: 404, headers: NO_STORE });

  const docs = [];
  for (const d of tender.documents.sort((a, b) => DOCUMENT_KIND_ORDER.indexOf(a.kind) - DOCUMENT_KIND_ORDER.indexOf(b.kind))) {
    if (await fileExists(d.fileKey)) docs.push(d);
  }
  if (docs.length === 0) return new Response("Документов нет", { status: 404, headers: NO_STORE });

  await trackDownload(user, tender.id);

  // Файлы уже сжаты (pdf, docx, xlsx, zip) — сжимаем слабо, чтобы архив собирался быстро.
  const archive = new ZipArchive({ zlib: { level: 1 } });
  const names = uniqueZipNames(docs.map((d) => d.fileName));
  docs.forEach((d, i) => archive.file(filePath(d.fileKey), { name: names[i] }));
  // Через обычный поток Node: так ответ корректно обрывается, если скачивание прервали.
  const out = new PassThrough();
  archive.on("warning", (e) => console.warn("ZIP:", e));
  archive.on("error", (e) => {
    console.error("ZIP:", e);
    out.destroy(e);
  });
  out.on("close", () => archive.abort());
  archive.pipe(out);
  void archive.finalize().catch(() => {});

  const zipName = `Документация — ${tender.title}`.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").slice(0, 150) + ".zip";
  return new Response(toWebStream(out), {
    headers: {
      ...NO_STORE,
      "Content-Type": "application/zip",
      "Content-Disposition": contentDisposition(zipName),
    },
  });
}
