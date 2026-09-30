"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, LogOut } from "lucide-react";
import { staffLogout } from "../login/actions";

const NAV = [
  { href: "/admin/tenders", label: "Тендеры" },
  { href: "/admin/projects", label: "Объекты" },
  { href: "/admin/work-types", label: "Виды работ" },
  { href: "/admin/contacts", label: "Контакты" },
];

export function AdminHeader({ email }: { email: string }) {
  const pathname = usePathname();
  const link = (active: boolean) =>
    `shrink-0 rounded-[10px] px-3 py-2 text-[15px] transition ${active ? "bg-accent-soft text-accent" : "text-white/85 hover:bg-white/10"}`;

  return (
    <header className="bg-dark text-white">
      <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/admin" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-accent font-display text-sm">Т</span>
          <span className="font-display text-[15px] leading-tight">Снабжение</span>
        </Link>
        <nav className="order-3 flex w-full flex-wrap gap-1 md:order-none md:w-auto">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={link(pathname.startsWith(n.href))}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex min-w-0 items-center gap-1">
          <Link href="/objects" className="flex h-10 items-center gap-1.5 rounded-[10px] px-2 text-sm text-white/75 hover:bg-white/10" title="Как видят подрядчики">
            <ExternalLink size={16} strokeWidth={1.75} />
            <span className="hidden sm:inline">Сайт</span>
          </Link>
          <span className="hidden max-w-[200px] truncate px-2 text-sm text-white/60 lg:block" title={email}>
            {email}
          </span>
          <form action={staffLogout}>
            <button className="flex h-10 items-center gap-1.5 rounded-[10px] px-2 text-sm text-white/75 hover:bg-white/10" title="Выйти">
              <LogOut size={18} strokeWidth={1.75} />
              <span className="hidden sm:inline">Выйти</span>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
