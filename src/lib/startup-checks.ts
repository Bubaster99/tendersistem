// Проверки при запуске рабочего сервера: лучше не запуститься, чем работать с небезопасными настройками.

const WEAK_SECRETS = ["dev-only-secret-change-me-in-env", "замените-на-длинную-случайную-строку"];

/** Список проблем настроек для рабочего режима. Пусто — всё в порядке. */
export function productionConfigProblems(env: Record<string, string | undefined> = process.env): string[] {
  const problems: string[] = [];
  const secret = env.AUTH_SECRET ?? "";
  if (secret.length < 32 || WEAK_SECRETS.includes(secret)) {
    problems.push("AUTH_SECRET — нужна длинная случайная строка не короче 32 символов (команда: openssl rand -hex 32)");
  }
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD || !env.SMTP_FROM) {
    problems.push("SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_FROM — без почты подрядчики не получат код входа");
  }
  if (!env.APP_URL?.startsWith("https://")) problems.push("APP_URL — адрес сайта с https://, например https://tender.example.ru");
  return problems;
}
