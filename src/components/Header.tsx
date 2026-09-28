"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Bell, LogOut, X } from "lucide-react";
import { logout } from "@/app/(app)/actions";
import { Logo } from "./Logo";

const NAV = [
  { href: "/objects", label: "Объекты" },
  { href: "/tenders", label: "Тендеры" },
  { href: "/my-bids", label: "Мои заявки" },
  { href: "/contacts", label: "Контакты" },
];

export function Header({ companyName }: { companyName: string }) {
  const pathname = usePathname();
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);

  const link = (active: boolean) =>
    `shrink-0 rounded-[10px] px-3 py-2 text-[15px] transition ${
      active ? "bg-accent-soft text-accent" : "text-ink hover:bg-bg"
    }`;

  return (
    <header className="border-b border-line bg-card">
      <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-4 px-4 py-3">
        <Logo href="/objects" />
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={link(pathname.startsWith(n.href))}>
              {n.label}
            </Link>
          ))}
          <button type="button" onClick={() => setSubscriptionOpen(true)} className={`${link(false)} flex items-center gap-1.5`}>
            <Bell size={16} strokeWidth={1.75} />
            Подписка
          </button>
        </nav>
        <div className="flex min-w-0 items-center gap-3">
          <span className="hidden max-w-[220px] truncate text-sm text-muted sm:block" title={companyName}>
            {companyName}
          </span>
          <form action={logout}>
            <button className="flex h-10 items-center gap-1.5 rounded-[10px] px-2 text-sm text-muted hover:bg-bg" title="Выйти">
              <LogOut size={18} strokeWidth={1.75} />
              <span className="hidden sm:inline">Выйти</span>
            </button>
          </form>
        </div>
      </div>

      {/* На телефоне и планшете — меню отдельной строкой под логотипом */}
      <nav className="flex flex-wrap gap-1 border-t border-line px-3 py-2 lg:hidden">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={link(pathname.startsWith(n.href))}>
            {n.label}
          </Link>
        ))}
        <button type="button" onClick={() => setSubscriptionOpen(true)} className={`${link(false)} flex items-center gap-1.5`}>
          <Bell size={16} strokeWidth={1.75} />
          Подписка
        </button>
      </nav>

      {subscriptionOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-dark/40" onClick={() => setSubscriptionOpen(false)}>
          <aside
            className="h-full w-full max-w-[420px] bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            aria-label="Подписка"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg">Подписка</h2>
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-[10px] hover:bg-bg"
                onClick={() => setSubscriptionOpen(false)}
                aria-label="Закрыть"
              >
                <X size={20} strokeWidth={1.75} />
              </button>
            </div>
            <p className="mt-4 text-muted">Настройка подписки на новые тендеры появится позже.</p>
          </aside>
        </div>
      )}
    </header>
  );
}
