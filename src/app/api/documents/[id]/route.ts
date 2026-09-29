import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { canDownload, NO_STORE, trackDownload } from "@/lib/downloads";
import { contentDisposition, mimeType } from "@/lib/files";
import { fileExists, readStream, toWebStream } from "@/lib/storage";

// Скачивание одного документа тендера. Права проверяются при каждом запросе.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Нужно войти", { status: 401, headers: NO_STORE });

  const { id } = await params;
  const doc = await prisma.tenderDocument.findUnique({
    where: { id },
    include: { tender: { select: { id: true, publishedAt: true, status: true, project: { select: { isPublished: true } } } } },
  });
  if (!doc || !canDownload(user, doc.tender)) return new Response("Не найдено", { status: 404, headers: NO_STORE });
  if (!(await fileExists(doc.fileKey))) return new Response("Файл не найден на сервере", { status: 404, headers: NO_STORE });

  await trackDownload(user, doc.tender.id);
  return new Response(toWebStream(readStream(doc.fileKey)), {
    headers: {
      ...NO_STORE,
      "Content-Type": mimeType(doc.fileName),
      "Content-Length": String(doc.size),
      "Content-Disposition": contentDisposition(doc.fileName),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
