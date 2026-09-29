import { Mail, Phone, Send, UserRound } from "lucide-react";

type ContactData = {
  id: string;
  name: string;
  role: string | null;
  scope?: string | null;
  phone: string | null;
  email: string | null;
  telegram: string | null;
  photo: string | null;
};

/** Карточка снабженца: ФИО, роль, виды работ, телефон, email, Telegram. */
export function ContactCard({ contact, workTypes = [] }: { contact: ContactData; workTypes?: string[] }) {
  const c = contact;
  const tel = c.phone?.replace(/[^\d+]/g, "");
  const row = "flex min-h-11 items-center gap-2.5 rounded-[10px] px-2 -mx-2 hover:bg-bg break-all";
  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <div className="flex items-center gap-3">
        {c.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/images/contacts/${c.id}?v=${encodeURIComponent(c.photo)}`} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
            <UserRound size={26} strokeWidth={1.5} />
          </span>
        )}
        <div className="min-w-0">
          <p className="font-medium leading-snug">{c.name}</p>
          {c.role && <p className="text-sm text-muted">{c.role}</p>}
        </div>
      </div>
      {(workTypes.length > 0 || c.scope) && (
        <div className="mt-3 text-sm">
          {workTypes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {workTypes.map((w) => (
                <span key={w} className="rounded-full bg-bg px-2.5 py-1">
                  {w}
                </span>
              ))}
            </div>
          )}
          {c.scope && <p className="mt-2 whitespace-pre-line text-muted">{c.scope}</p>}
        </div>
      )}
      <div className="mt-3 space-y-0.5 text-[15px]">
        {c.phone && (
          <a href={`tel:${tel}`} className={row}>
            <Phone size={18} strokeWidth={1.75} className="shrink-0 text-muted" /> {c.phone}
          </a>
        )}
        {c.email && (
          <a href={`mailto:${c.email}`} className={row}>
            <Mail size={18} strokeWidth={1.75} className="shrink-0 text-muted" /> {c.email}
          </a>
        )}
        {c.telegram && (
          <a href={`https://t.me/${encodeURIComponent(c.telegram)}`} target="_blank" rel="noopener noreferrer" className={row}>
            <Send size={18} strokeWidth={1.75} className="shrink-0 text-muted" /> @{c.telegram}
          </a>
        )}
      </div>
    </div>
  );
}
