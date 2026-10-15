// Если почта не работает, подрядчик видит понятную ошибку, а неотправленный код не остаётся в базе.
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("./mailer", () => ({ sendMail: vi.fn().mockRejectedValue(new Error("SMTP недоступен")) }));

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("Вход: сбой почты", async () => {
  const { prisma } = await import("./db");
  const { issueLoginCode } = await import("./login-flow");
  const email = `mailfail-${Date.now()}@test.ru`;

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("ошибка показывается, код удаляется, повторный запрос не блокируется лимитом", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await issueLoginCode(email);
    expect(res).toMatchObject({ ok: false, error: expect.stringContaining("Не удалось отправить письмо") });
    expect(await prisma.loginCode.count({ where: { email } })).toBe(0);
    // Неудачная попытка не съедает ограничение «раз в минуту».
    expect(await issueLoginCode(email)).toMatchObject({ error: expect.stringContaining("Не удалось отправить письмо") });
  });
});
