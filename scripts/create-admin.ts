// Создать администратора: npm run create-admin -- name@company.ru
// В Docker: docker compose exec app npm run create-admin -- name@company.ru
import { PrismaClient } from "@prisma/client";
import { ensureAdmin } from "../prisma/admin";

const email = process.argv[2] || process.env.ADMIN_EMAIL;
if (!email) {
  console.error("Укажите email: npm run create-admin -- name@company.ru");
  process.exit(1);
}

const prisma = new PrismaClient();
ensureAdmin(prisma, email)
  .then((msg) => console.log(msg))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
