import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const CODE_LENGTH = 6;
export const CODE_TTL_MS = 10 * 60 * 1000; // 10 минут
export const CODE_MAX_ATTEMPTS = 5;
export const CODE_RESEND_INTERVAL_MS = 60 * 1000; // не чаще раза в минуту на один email
export const CODE_MAX_PER_HOUR = 5;

export function generateCode(): string {
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
}

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET не задан в .env (нужно минимум 16 символов)");
  return s;
}

/** Код храним только в виде хэша, привязанного к email. */
export function hashCode(email: string, code: string): string {
  return createHmac("sha256", secret()).update(`${email}:${code}`).digest("hex");
}

export function codeMatches(email: string, code: string, hash: string): boolean {
  const a = Buffer.from(hashCode(email, code), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
