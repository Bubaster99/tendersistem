import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/access";
import { btnPrimary, cardCls } from "@/components/ui";

export default async function AdminContactsPage() {
  await requireStaffPage();
  const contacts = await prisma.contact.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl">Контакты</h1>
        <Link href="/admin/contacts/new" className={btnPrimary}>
          <Plus size={18} strokeWidth={1.75} /> Добавить контакт
        </Link>
      </div>
      <p className="mt-2 text-muted">Эти люди показываются подрядчикам на странице «Контакты» и в карточках тендеров.</p>
      <div className={`${cardCls} mt-6 divide-y divide-line`}>
        {contacts.length === 0 && <p className="p-5 text-muted">Контактов пока нет.</p>}
        {contacts.map((c) => (
          <Link key={c.id} href={`/admin/contacts/${c.id}`} className="block p-4 hover:bg-bg">
            <p className="font-medium">{c.name}</p>
            <p className="text-sm text-muted">{[c.role, c.phone, c.email].filter(Boolean).join(" · ")}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
