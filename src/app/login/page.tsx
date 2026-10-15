import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { Logo } from "@/components/Logo";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Вход — Тендерная площадка" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/objects");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col px-4 py-6 sm:py-12">
      <Logo href="/login" />
      <div className="mt-8 sm:mt-12">
        <h1 className="font-display text-2xl leading-tight sm:text-[28px]">Вход и регистрация</h1>
        <p className="mt-2 text-muted">
          Без пароля и документов: укажите ИНН и email, мы пришлём код для входа.
        </p>
      </div>
      <div className="mt-6">
        <LoginForm />
      </div>
      <nav className="mt-auto flex flex-wrap gap-x-5 gap-y-2 pt-10 text-sm text-muted">
        <Link href="/about" className="underline underline-offset-2 hover:text-ink">
          О площадке
        </Link>
        <Link href="/rules" className="underline underline-offset-2 hover:text-ink">
          Положение о тендерах
        </Link>
        <Link href="/privacy" className="underline underline-offset-2 hover:text-ink">
          Политика обработки ПДн
        </Link>
      </nav>
    </main>
  );
}
