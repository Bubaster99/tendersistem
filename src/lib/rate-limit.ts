// Простой ограничитель частоты по ключу (обычно IP) — в памяти сервера. Площадка работает на одном сервере,
// поэтому этого достаточно: защищает от перебора и от трат лимита DaData и почты.

type Bucket = { count: number; resetAt: number };
const g = globalThis as unknown as { rateLimits?: Map<string, Bucket> };
const buckets = (g.rateLimits ??= new Map());

/** true — можно; false — лимит исчерпан. limit запросов за windowMs. */
export function allow(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  if (buckets.size > 50_000) for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k); // уборка
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}

export const HOUR = 60 * 60 * 1000;
export const TOO_MANY = "Слишком много запросов. Попробуйте через час";
