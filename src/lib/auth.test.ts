import { describe, expect, it, beforeAll } from "vitest";
import { isValidEmail, isValidInn, normalizeEmail, normalizeInn } from "./validation";
import { CODE_LENGTH, codeMatches, generateCode, hashCode } from "./login-code";
import { stubCompany } from "./dadata";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-test-secret-test-secret";
});

describe("ИНН и email", () => {
  it("принимает только 10 или 12 цифр", () => {
    expect(isValidInn("7707083893")).toBe(true);
    expect(isValidInn("500100732259")).toBe(true);
    expect(isValidInn("12345")).toBe(false);
    expect(isValidInn("77070838931")).toBe(false);
    expect(normalizeInn(" 7707-083 893 ")).toBe("7707083893");
  });

  it("нормализует и проверяет email", () => {
    expect(normalizeEmail("  Ivan@Mail.RU ")).toBe("ivan@mail.ru");
    expect(isValidEmail("ivan@mail.ru")).toBe(true);
    expect(isValidEmail("ivan@mail")).toBe(false);
  });
});

describe("Коды входа", () => {
  it("генерирует 6 цифр", () => {
    for (let i = 0; i < 50; i++) expect(generateCode()).toMatch(new RegExp(`^\\d{${CODE_LENGTH}}$`));
  });

  it("хранит хэш, а не сам код, и проверяет его", () => {
    const hash = hashCode("a@b.ru", "123456");
    expect(hash).not.toContain("123456");
    expect(codeMatches("a@b.ru", "123456", hash)).toBe(true);
    expect(codeMatches("a@b.ru", "654321", hash)).toBe(false);
    // Код, выданный на другой email, не подходит.
    expect(codeMatches("c@d.ru", "123456", hash)).toBe(false);
  });
});

describe("Заглушка DaData", () => {
  it("возвращает тестовую компанию и «не найдено» для нулей", () => {
    expect(stubCompany("7707083893")?.name).toContain("Тестстрой");
    expect(stubCompany("0000000000")).toBeNull();
  });
});
