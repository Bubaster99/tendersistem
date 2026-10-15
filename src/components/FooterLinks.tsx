import Link from "next/link";

const LINKS = [
  { href: "/about", label: "О площадке" },
  { href: "/rules", label: "Положение о тендерах" },
  { href: "/privacy", label: "Политика обработки персональных данных" },
  { href: "/login", label: "Вход для подрядчиков" },
];

/** Ссылки на публичные страницы — отдельными плашками, чтобы не сливались в одну строку. */
export function FooterLinks({ hide, className = "" }: { hide?: string; className?: string }) {
  return (
    <nav className={`flex flex-wrap gap-2 ${className}`} aria-label="Документы площадки">
      {LINKS.filter((l) => l.href !== hide).map((l) => (
        <Link key={l.href} href={l.href} className="rounded-full border border-line bg-card px-4 py-2 text-sm text-muted transition hover:border-ink hover:text-ink">
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
