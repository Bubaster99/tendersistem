import { getCurrentUser } from "@/lib/session";
import { bidFileForDownload } from "@/lib/bids";
import { NO_STORE } from "@/lib/downloads";
import { contentDisposition, mimeType } from "@/lib/files";
import { ipFromHeaders } from "@/lib/request-ip";
import { fileExists, readStream, toWebStream } from "@/lib/storage";

// Скачивание файла КП. Права проверяются при каждом запросе (раздел 6 SPEC.md):
// своё КП — всегда, снабжение и админ — только после дедлайна, остальным — «не найдено».
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Нужно войти", { status: 401, headers: NO_STORE });

  const { id } = await params;
  const file = await bidFileForDownload(user, id, ipFromHeaders(req.headers));
  if (!file) return new Response("Не найдено", { status: 404, headers: NO_STORE });
  if (!(await fileExists(file.fileKey))) return new Response("Файл не найден на сервере", { status: 404, headers: NO_STORE });

  return new Response(toWebStream(readStream(file.fileKey)), {
    headers: {
      ...NO_STORE,
      "Content-Type": mimeType(file.fileName),
      "Content-Length": String(file.fileSize),
      "Content-Disposition": contentDisposition(file.fileName),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
