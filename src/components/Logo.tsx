import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 text-ink">
      <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-accent font-display text-sm text-white">Т</span>
      <span className="font-display text-[15px] leading-tight">Тендерная площадка</span>
    </Link>
  );
}
