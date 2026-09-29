import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { isStaffRole } from "@/lib/access";
import { Logo } from "@/components/Logo";
import { AdminLoginForm } from "./AdminLoginForm";

export const metadata = { title: "Вход для снабжения — Тендерная площадка" };

export default async function AdminLoginPage() {
  const user = await getCurrentUser();
  if (user && isStaffRole(user.role)) redirect("/admin");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col px-4 py-6 sm:py-12">
      <Logo href="/admin/login" />
      <div className="mt-8 sm:mt-12">
        <h1 className="font-display text-2xl leading-tight sm:text-[28px]">Вход для снабжения</h1>
        <p className="mt-2 text-muted">Укажите рабочий email — мы пришлём код для входа.</p>
      </div>
      <div className="mt-6">
        <AdminLoginForm />
      </div>
    </main>
  );
}
