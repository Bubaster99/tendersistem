"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaffAction } from "@/lib/access";
import { checkImage } from "@/lib/files";
import { bool, file, int, str } from "@/lib/form";
import { removeFile, saveUpload } from "@/lib/storage";
import { isValidEmail, normalizeEmail } from "@/lib/validation";
import type { ActionResult } from "@/components/ActionForm";

export async function saveContact(id: string | null, fd: FormData): Promise<ActionResult> {
  await requireStaffAction();

  const name = str(fd, "name", 200);
  if (!name) return { error: "Укажите ФИО" };
  const rawEmail = str(fd, "email", 254);
  const email = rawEmail ? normalizeEmail(rawEmail) : null;
  if (email && !isValidEmail(email)) return { error: "Проверьте email" };
  const photo = file(fd, "photo");
  if (photo) {
    const bad = checkImage(photo.name, photo.size);
    if (bad) return { error: bad };
  }

  const data = {
    name,
    role: str(fd, "role", 200),
    scope: str(fd, "scope", 1000),
    phone: str(fd, "phone", 50),
    email,
    telegram: str(fd, "telegram", 100)?.replace(/^@/, "").replace(/^https?:\/\/t\.me\//, "") ?? null,
    sortOrder: int(fd, "sortOrder"),
  };

  const existing = id ? await prisma.contact.findUnique({ where: { id } }) : null;
  if (id && !existing) return { error: "Контакт не найден" };

  let photoKey = existing?.photo ?? null;
  if (photo) photoKey = await saveUpload(photo, "photos");
  else if (bool(fd, "removePhoto")) photoKey = null;

  if (existing) await prisma.contact.update({ where: { id: existing.id }, data: { ...data, photo: photoKey } });
  else await prisma.contact.create({ data: { ...data, photo: photoKey } });

  if (existing?.photo && existing.photo !== photoKey) await removeFile(existing.photo);

  revalidatePath("/", "layout");
  redirect("/admin/contacts");
}

export async function deleteContact(id: string): Promise<ActionResult> {
  await requireStaffAction();
  const contact = await prisma.contact.findUnique({ where: { id } });
  if (!contact) return { error: "Контакт не найден" };
  // Тендеры и виды работ, где он был ответственным, останутся без контакта.
  await prisma.contact.delete({ where: { id } });
  await removeFile(contact.photo);
  revalidatePath("/", "layout");
  redirect("/admin/contacts");
}
