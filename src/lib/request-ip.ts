import "server-only";
import { headers } from "next/headers";

/** IP посетителя для журнала действий (за прокси — из X-Forwarded-For). */
export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return ipFromHeaders(h);
}

export function ipFromHeaders(h: Headers): string | null {
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || null;
}
