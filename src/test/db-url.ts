// Тесты с базой работают в отдельной схеме «vitest» той же базы — рабочие данные не трогаются.
export const TEST_SCHEMA = "vitest";

export function testDatabaseUrl(): string | undefined {
  const base = process.env.DATABASE_URL;
  if (!base) return undefined;
  const url = new URL(base);
  url.searchParams.set("schema", TEST_SCHEMA);
  return url.toString();
}
