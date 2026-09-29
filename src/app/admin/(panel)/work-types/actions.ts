"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireStaffAction } from "@/lib/access";
import { str } from "@/lib/form";
import type { ActionResult } from "@/components/ActionForm";

async function checkContact(id: string | null): Promise<boolean> {
  return !id || (await prisma.contact.count({ where: { id } })) > 0;
}

export async function saveWorkType(id: string | null, fd: FormData): Promise<ActionResult> {
  await requireStaffAction();
  const name = str(fd, "name", 200);
  if (!name) return { error: "Укажите название" };
  const responsibleContactId = str(fd, "responsibleContactId", 50);
  if (!(await checkContact(responsibleContactId))) return { error: "Контакт не найден" };

  const same = await prisma.workType.findFirst({ where: { name: { equals: name, mode: "insensitive" }, NOT: id ? { id } : undefined } });
  if (same) return { error: `Вид работ «${same.name}» уже есть` };

  if (id) await prisma.workType.update({ where: { id }, data: { name, responsibleContactId } });
  else await prisma.workType.create({ data: { name, responsibleContactId } });

  revalidatePath("/", "layout");
  return { message: id ? "Сохранено" : "Добавлено" };
}

export async function deleteWorkType(id: string): Promise<ActionResult> {
  await requireStaffAction();
  const used = await prisma.tender.count({ where: { workTypeId: id } });
  if (used > 0) return { error: "По этому виду работ есть тендеры — удалить нельзя" };
  await prisma.workType.deleteMany({ where: { id } });
  revalidatePath("/", "layout");
}
