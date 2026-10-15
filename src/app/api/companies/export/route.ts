import { getCurrentUser } from "@/lib/session";
import { isStaffRole } from "@/lib/access-rules";
import { companiesXlsx } from "@/lib/companies";
import { NO_STORE } from "@/lib/downloads";
import { contentDisposition } from "@/lib/files";

// Реестр подрядчиков в Excel — только снабжение и админ.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Нужно войти", { status: 401, headers: NO_STORE });
  if (!isStaffRole(user.role)) return new Response("Не найдено", { status: 404, headers: NO_STORE });
  const sp = new URL(req.url).searchParams;
  const buf = await companiesXlsx({ q: sp.get("q") ?? undefined, workType: sp.get("workType") ?? undefined, status: sp.get("status") ?? undefined, rating: sp.get("rating") ?? undefined });
  return new Response(new Uint8Array(buf), {
    headers: {
      ...NO_STORE,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Length": String(buf.length),
      "Content-Disposition": contentDisposition(`Подрядчики ${new Date().toISOString().slice(0, 10)}.xlsx`),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
