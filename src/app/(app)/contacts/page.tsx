import { Send } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUserPage } from "@/lib/access";
import { ContactCard } from "@/components/ContactCard";

export const metadata = { title: "Контакты — Тендерная площадка" };

export default async function ContactsPage() {
  await requireUserPage();
  const contacts = await prisma.contact.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { workTypes: { select: { name: true }, orderBy: { name: "asc" } } },
  });
  const channel = process.env.TELEGRAM_CHANNEL_URL?.trim();

  return (
    <div>
      <h1 className="font-display text-2xl sm:text-3xl">Контакты</h1>
      <p className="mt-2 text-muted">Отдел снабжения. Пишите и звоните по вопросам тендеров.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {contacts.map((c) => (
          <ContactCard key={c.id} contact={c} workTypes={c.workTypes.map((w) => w.name)} />
        ))}

        <div className="flex flex-col rounded-2xl bg-dark p-5 text-white">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-white/10">
            <Send size={24} strokeWidth={1.5} />
          </span>
          <p className="mt-3 font-medium">Telegram-канал с тендерами</p>
          <p className="mt-1 text-sm text-white/70">Публикуем каждый тендер в момент открытия приёма КП.</p>
          <div className="mt-auto pt-4">
            {channel ? (
              <a
                href={channel}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 items-center justify-center rounded-[10px] bg-accent px-5 font-medium hover:opacity-90"
              >
                Открыть канал
              </a>
            ) : (
              <p className="rounded-[10px] bg-white/10 px-4 py-3 text-sm text-white/80">Канал скоро появится</p>
            )}
          </div>
        </div>
      </div>
      {contacts.length === 0 && <p className="mt-4 text-muted">Контакты скоро появятся.</p>}
    </div>
  );
}
