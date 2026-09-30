import { requireStaffPage } from "@/lib/access";
import { AdminHeader } from "./AdminHeader";

export const metadata = { title: "Снабжение — Тендерная площадка" };

// Все страницы админки: только для ролей buyer и admin (проверка на сервере).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaffPage();
  return (
    <>
      <AdminHeader email={user.email} />
      <main className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:py-8">{children}</main>
    </>
  );
}
