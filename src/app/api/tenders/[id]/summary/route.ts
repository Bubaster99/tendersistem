import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { isStaffRole } from "@/lib/access-rules";
import { closeExpiredTenders, staffTenderBids } from "@/lib/bids";
import { NO_STORE } from "@/lib/downloads";
import { contentDisposition } from "@/lib/files";
import { ipFromHeaders } from "@/lib/request-ip";
import { buildSummaryXlsx } from "@/lib/summary-xlsx";

// Сводная таблица КП в Excel. Только снабжение и админ и только после дедлайна — проверка в staffTenderBids.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Нужно войти", { status: 401, headers: NO_STORE });
  if (!isStaffRole(user.role)) return new Response("Не найдено", { status: 404, headers: NO_STORE });

  const { id } = await params;
  await closeExpiredTenders();
  const tender = await prisma.tender.findUnique({
    where: { id },
    select: { title: true, deadlineAt: true, rebidDeadlineAt: true, budget: true, winnerCompanyId: true, project: { select: { name: true } }, workType: { select: { name: true } } },
  });
  if (!tender) return new Response("Не найдено", { status: 404, headers: NO_STORE });
  const bids = await staffTenderBids(user, id, ipFromHeaders(req.headers), new Date(), "bid.export");
  if (!bids || bids.sealed) return new Response("КП ещё запечатаны — сводная будет доступна после окончания приёма", { status: 403, headers: NO_STORE });

  const buf = await buildSummaryXlsx({
    title: tender.title,
    projectName: tender.project.name,
    workTypeName: tender.workType.name,
    deadlineAt: tender.deadlineAt,
    rebidDeadlineAt: tender.rebidDeadlineAt,
    budget: tender.budget === null ? null : Number(String(tender.budget)),
    round1: bids.bids,
    round2: bids.round2 && !bids.round2.sealed ? bids.round2.bids : [],
    winnerCompanyId: tender.winnerCompanyId,
  });
  const name = `Сводная КП — ${tender.title}`.replace(/[\\/:*?"<>|]/g, " ").slice(0, 120) + ".xlsx";
  return new Response(new Uint8Array(buf), {
    headers: {
      ...NO_STORE,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Length": String(buf.length),
      "Content-Disposition": contentDisposition(name),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
