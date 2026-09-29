import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { isStaffRole } from "@/lib/access";
import { Header } from "@/components/Header";

// Все страницы подрядчика: без входа — на страницу входа.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <>
      <Header companyName={user.company?.name ?? user.email} isStaff={isStaffRole(user.role)} />
      <main className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:py-10">{children}</main>
    </>
  );
}
