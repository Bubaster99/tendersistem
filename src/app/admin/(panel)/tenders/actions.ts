"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { DocumentKind, TenderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireStaffAction } from "@/lib/access";
import { closeExpiredTenders } from "@/lib/bids";
import { checkDocument } from "@/lib/files";
import { decimal, file, str } from "@/lib/form";
import { removeFile, saveUpload } from "@/lib/storage";
import { parseMoscowInput } from "@/lib/time";
import { DOCUMENT_KIND_ORDER } from "@/lib/tenders";
import type { ActionResult } from "@/components/ActionForm";

type Intent = "save" | "draft" | "planned" | "open";

/**
 * Создание и редактирование тендера.
 * Кнопки: «Сохранить черновик» (не виден подрядчикам), «Опубликовать как “Скоро”», «Открыть приём КП», «Сохранить».
 */
export async function saveTender(id: string | null, fd: FormData): Promise<ActionResult> {
  const user = await requireStaffAction();
  const intentRaw = String(fd.get("intent") ?? "save");
  const intent: Intent = (["save", "draft", "planned", "open"] as const).find((i) => i === intentRaw) ?? "save";

  await closeExpiredTenders();
  const existing = id ? await prisma.tender.findUnique({ where: { id } }) : null;
  if (id && !existing) return { error: "Тендер не найден" };

  const title = str(fd, "title", 300);
  if (!title) return { error: "Укажите название тендера" };
  const projectId = str(fd, "projectId", 50);
  const workTypeId = str(fd, "workTypeId", 50);
  const [project, workType] = await Promise.all([
    projectId ? prisma.project.findUnique({ where: { id: projectId } }) : null,
    workTypeId ? prisma.workType.findUnique({ where: { id: workTypeId } }) : null,
  ]);
  if (!project) return { error: "Выберите объект" };
  if (!workType) return { error: "Выберите вид работ" };

  let contactId = str(fd, "contactId", 50);
  if (contactId && (await prisma.contact.count({ where: { id: contactId } })) === 0) return { error: "Контакт не найден" };
  if (!contactId) contactId = workType.responsibleContactId; // по умолчанию — ответственный за вид работ

  const retention = decimal(fd, "retentionPercent");
  if (retention !== null && (Number.isNaN(retention) || retention < 0 || retention > 100)) {
    return { error: "Гарантийное удержание — число от 0 до 100" };
  }

  const deadlineRaw = str(fd, "deadlineAt", 30);
  const deadlineAt = parseMoscowInput(deadlineRaw);
  if (deadlineRaw && !deadlineAt) return { error: "Проверьте дату и время приёма КП" };

  // Статус и публикация.
  let status: TenderStatus = existing?.status ?? "planned";
  let publishedAt = existing?.publishedAt ?? null;
  const now = new Date();
  if (intent === "draft") {
    if (publishedAt) return { error: "Тендер уже опубликован — его нельзя вернуть в черновик" };
    status = "planned";
  } else if (intent === "planned") {
    if (existing && existing.status !== "planned") return { error: "«Скоро» можно опубликовать только новый тендер" };
    status = "planned";
    publishedAt ??= now;
  } else if (intent === "open") {
    if (existing && existing.status !== "planned") return { error: "Приём КП уже открывался по этому тендеру" };
    status = "open";
    publishedAt ??= now;
  }

  // Приём КП нельзя открыть с прошедшим дедлайном (время серверное, московское).
  const deadlineChanged = (deadlineAt?.getTime() ?? null) !== (existing?.deadlineAt?.getTime() ?? null);
  if (existing && deadlineChanged) {
    // Запечатанные КП: срок нельзя двигать так, чтобы вскрыть КП раньше, чем обещали участникам.
    if (existing.status !== "planned" && existing.status !== "open") return { error: "Приём КП завершён — срок окончания приёма менять нельзя" };
    const hasBids = (await prisma.bid.count({ where: { tenderId: existing.id } })) > 0;
    if (hasBids && existing.deadlineAt && (!deadlineAt || deadlineAt < existing.deadlineAt)) {
      return { error: "КП уже поданы — окончание приёма можно только продлить, но не сократить" };
    }
  }
  if (status === "open" && (intent === "open" || deadlineChanged)) {
    if (!deadlineAt) return { error: "Чтобы открыть приём КП, укажите дату и время окончания приёма" };
    if (deadlineAt <= now) return { error: "Дата окончания приёма КП уже прошла" };
  }

  const data = {
    title,
    projectId: project.id,
    workTypeId: workType.id,
    scope: str(fd, "scope", 20000),
    plannedStart: str(fd, "plannedStart", 100),
    deadlineAt,
    workStart: str(fd, "workStart", 100),
    paymentTerms: str(fd, "paymentTerms", 1000),
    retentionPercent: retention,
    contactId,
    status,
    publishedAt,
  };

  revalidatePath("/", "layout");
  if (existing) {
    await prisma.tender.update({ where: { id: existing.id }, data });
    const msg: Record<Intent, string> = {
      save: "Сохранено",
      draft: "Черновик сохранён",
      planned: "Опубликован как «Скоро»",
      open: "Приём КП открыт",
    };
    return { message: msg[intent] };
  }
  const created = await prisma.tender.create({ data: { ...data, createdById: user.id } });
  redirect(`/admin/tenders/${created.id}?created=1`);
}

export async function deleteTender(id: string): Promise<ActionResult> {
  await requireStaffAction();
  const tender = await prisma.tender.findUnique({ where: { id }, include: { documents: true } });
  if (!tender) return { error: "Тендер не найден" };
  if (tender.publishedAt) return { error: "Опубликованный тендер удалить нельзя" };
  await prisma.tender.delete({ where: { id } });
  for (const d of tender.documents) await removeFile(d.fileKey);
  revalidatePath("/", "layout");
  redirect("/admin/tenders");
}

export async function uploadDocument(tenderId: string, fd: FormData): Promise<ActionResult> {
  await requireStaffAction();
  const tender = await prisma.tender.findUnique({ where: { id: tenderId } });
  if (!tender) return { error: "Тендер не найден" };

  const kindRaw = String(fd.get("kind") ?? "");
  const kind = DOCUMENT_KIND_ORDER.find((k) => k === kindRaw) as DocumentKind | undefined;
  if (!kind) return { error: "Выберите тип документа" };
  const f = file(fd, "file");
  if (!f) return { error: "Выберите файл" };
  const bad = checkDocument(f.name, f.size, kind);
  if (bad) return { error: bad };

  const fileKey = await saveUpload(f, `tenders/${tender.id}`);
  const fileName = f.name.replace(/[\\/]/g, "_").slice(0, 200);

  // ВОР и шаблон КП — ровно один: новый заменяет старый.
  const old = kind === "bom_template" ? await prisma.tenderDocument.findMany({ where: { tenderId, kind } }) : [];
  await prisma.$transaction([
    prisma.tenderDocument.deleteMany({ where: { id: { in: old.map((d) => d.id) } } }),
    prisma.tenderDocument.create({ data: { tenderId, kind, fileKey, fileName, size: f.size } }),
  ]);
  for (const d of old) await removeFile(d.fileKey);

  revalidatePath("/", "layout");
  return { message: old.length ? `Файл «${fileName}» загружен и заменил прежний ВОР` : `Файл «${fileName}» загружен` };
}

export async function deleteDocument(documentId: string): Promise<ActionResult> {
  await requireStaffAction();
  const doc = await prisma.tenderDocument.findUnique({ where: { id: documentId } });
  if (!doc) return { error: "Документ не найден" };
  await prisma.tenderDocument.delete({ where: { id: doc.id } });
  await removeFile(doc.fileKey);
  revalidatePath("/", "layout");
}
