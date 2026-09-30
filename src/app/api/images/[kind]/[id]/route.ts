import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { isStaffRole } from "@/lib/access";
import { mimeType } from "@/lib/files";
import { fileExists, readStream, toWebStream } from "@/lib/storage";

// Картинки объектов и фото снабженцев — только для вошедших пользователей.
export async function GET(_req: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Нужно войти", { status: 401 });
  const { kind, id } = await params;

  let key: string | null = null;
  if (kind === "projects") {
    const p = await prisma.project.findUnique({ where: { id }, select: { coverImage: true, isPublished: true } });
    if (p && (p.isPublished || isStaffRole(user.role))) key = p.coverImage;
  } else if (kind === "contacts") {
    const c = await prisma.contact.findUnique({ where: { id }, select: { photo: true } });
    key = c?.photo ?? null;
  }
  if (!key || !(await fileExists(key))) return new Response("Не найдено", { status: 404 });

  return new Response(toWebStream(readStream(key)), {
    headers: {
      "Content-Type": mimeType(key),
      // Адрес картинки меняется вместе с файлом (?v=…), поэтому можно кэшировать в браузере.
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
