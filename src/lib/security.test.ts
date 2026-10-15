// Ревизия безопасности перед запуском: настройки рабочего сервера и ограничение частоты запросов.
import { describe, expect, it } from "vitest";
import { productionConfigProblems } from "./startup-checks";
import { allow } from "./rate-limit";

describe("Настройки рабочего сервера", () => {
  const good = {
    AUTH_SECRET: "a".repeat(64),
    SMTP_HOST: "smtp.yandex.ru",
    SMTP_USER: "noreply@x.ru",
    SMTP_PASSWORD: "p",
    SMTP_FROM: "Площадка <noreply@x.ru>",
    APP_URL: "https://tender.x.ru",
    DADATA_API_KEY: "key",
  };

  it("правильные настройки — без замечаний", () => {
    expect(productionConfigProblems(good)).toEqual([]);
  });

  it("не запускаемся с тестовым или коротким секретом, без почты и без https", () => {
    expect(productionConfigProblems({ ...good, AUTH_SECRET: "dev-only-secret-change-me-in-env" })).toHaveLength(1);
    expect(productionConfigProblems({ ...good, AUTH_SECRET: "short" })).toHaveLength(1);
    expect(productionConfigProblems({ ...good, SMTP_HOST: "" })).toHaveLength(1);
    expect(productionConfigProblems({ ...good, APP_URL: "http://tender.x.ru" })).toHaveLength(1);
    expect(productionConfigProblems({ ...good, DADATA_API_KEY: "" })).toHaveLength(1); // иначе реквизиты — тестовые
  });

  it("все проблемы перечисляются сразу, а не по одной", () => {
    expect(productionConfigProblems({})).toHaveLength(4);
  });
});

describe("Ограничение частоты запросов", () => {
  it("пропускает limit запросов за окно, дальше — отказ, после окна — снова можно", () => {
    const key = `t-${Math.random()}`;
    for (let i = 0; i < 3; i++) expect(allow(key, 3, 1000, 0)).toBe(true);
    expect(allow(key, 3, 1000, 10)).toBe(false);
    expect(allow(key, 3, 1000, 1001)).toBe(true);
    expect(allow(`${key}-другой`, 3, 1000, 10)).toBe(true); // другой IP — свой счётчик
  });
});
