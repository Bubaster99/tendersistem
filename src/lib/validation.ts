// Проверки ввода. Используются на сервере — клиенту не доверяем.

export function normalizeInn(raw: string): string {
  return String(raw ?? "").replace(/\D/g, "");
}

/** ИНН — 10 цифр (организация) или 12 цифр (ИП). */
export function isValidInn(inn: string): boolean {
  return /^(\d{10}|\d{12})$/.test(inn);
}

export function normalizeEmail(raw: string): string {
  return String(raw ?? "").trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
