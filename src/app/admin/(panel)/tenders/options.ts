import "server-only";
import { prisma } from "@/lib/db";

/** Списки для выпадающих полей формы тендера. */
export async function tenderFormOptions() {
  const [projects, workTypes, contacts] = await Promise.all([
    prisma.project.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, name: true } }),
    prisma.workType.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.contact.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);
  return { projects, workTypes, contacts };
}
