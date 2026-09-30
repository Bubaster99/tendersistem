import type { UserRole } from "@prisma/client";

export function isStaffRole(role: UserRole): boolean {
  return role === "buyer" || role === "admin";
}
