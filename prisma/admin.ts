import type { PrismaClient } from "@prisma/client";

/** Создаёт администратора (или повышает существующего сотрудника до admin). */
export async function ensureAdmin(prisma: PrismaClient, rawEmail: string): Promise<string> {
  const email = rawEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`Неверный email: ${rawEmail}`);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.role === "contractor") {
    throw new Error(`${email} уже зарегистрирован как подрядчик — укажите другой email для админки`);
  }
  if (existing?.role === "admin") return `Администратор ${email} уже есть`;
  await prisma.user.upsert({ where: { email }, update: { role: "admin" }, create: { email, role: "admin" } });
  return `Администратор ${email} создан`;
}
