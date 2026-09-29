"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaffAction } from "@/lib/access";
import { checkImage } from "@/lib/files";
import { bool, file, int, str } from "@/lib/form";
import { removeFile, saveUpload } from "@/lib/storage";
import type { ActionResult } from "@/components/ActionForm";

export async function saveProject(id: string | null, fd: FormData): Promise<ActionResult> {
  await requireStaffAction();

  const name = str(fd, "name", 200);
  if (!name) return { error: "Укажите название объекта" };
  const cover = file(fd, "coverImage");
  if (cover) {
    const bad = checkImage(cover.name, cover.size);
    if (bad) return { error: bad };
  }

  const data = {
    name,
    address: str(fd, "address"),
    stage: str(fd, "stage", 200),
    finishDate: str(fd, "finishDate", 100),
    size: str(fd, "size", 200),
    sortOrder: int(fd, "sortOrder"),
    isPublished: bool(fd, "isPublished"),
  };

  const existing = id ? await prisma.project.findUnique({ where: { id } }) : null;
  if (id && !existing) return { error: "Объект не найден" };

  let coverImage = existing?.coverImage ?? null;
  if (cover) coverImage = await saveUpload(cover, "covers");
  else if (bool(fd, "removeCover")) coverImage = null;

  if (existing) await prisma.project.update({ where: { id: existing.id }, data: { ...data, coverImage } });
  else await prisma.project.create({ data: { ...data, coverImage } });

  if (existing?.coverImage && existing.coverImage !== coverImage) await removeFile(existing.coverImage);

  revalidatePath("/", "layout");
  redirect("/admin/projects");
}

export async function deleteProject(id: string): Promise<ActionResult> {
  await requireStaffAction();
  const project = await prisma.project.findUnique({ where: { id }, include: { _count: { select: { tenders: true } } } });
  if (!project) return { error: "Объект не найден" };
  if (project._count.tenders > 0) {
    return { error: "У объекта есть тендеры — удалить нельзя. Снимите галочку «Показывать подрядчикам», чтобы скрыть его." };
  }
  await prisma.project.delete({ where: { id } });
  await removeFile(project.coverImage);
  revalidatePath("/", "layout");
  redirect("/admin/projects");
}
