import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { isStaffRole } from "@/lib/access";
import { prisma } from "@/lib/db";
import { getSubscription } from "@/lib/subscription";
import { Header } from "@/components/Header";
import type { SubscriptionPanelData } from "@/components/SubscriptionPanel";

// Все страницы подрядчика: без входа — на страницу входа.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Данные для панели «Подписка» — только подрядчику.
  let subscription: SubscriptionPanelData | null = null;
  if (user.role === "contractor" && user.companyId) {
    const [workTypes, projects, current] = await Promise.all([
      prisma.workType.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      prisma.project.findMany({ where: { isPublished: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, name: true } }),
      getSubscription(user.companyId),
    ]);
    subscription = { workTypes, projects, current };
  }

  return (
    <>
      <Header companyName={user.company?.name ?? user.email} isStaff={isStaffRole(user.role)} subscription={subscription} />
      <main className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:py-10">{children}</main>
    </>
  );
}
