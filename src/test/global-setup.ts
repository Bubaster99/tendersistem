// Перед тестами: пересоздаём тестовую схему «vitest» и накатываем миграции.
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { TEST_SCHEMA, testDatabaseUrl } from "./db-url";

export default async function setup() {
  const url = testDatabaseUrl();
  if (!url) {
    console.warn("\nDATABASE_URL не задан — тесты с базой пропущены. Запустите: docker compose exec app npm test\n");
    return;
  }
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`);
  } finally {
    await prisma.$disconnect();
  }
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "ignore" });
}
