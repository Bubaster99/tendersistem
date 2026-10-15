import { TriangleAlert } from "lucide-react";
import { FooterLinks } from "./FooterLinks";
import { Logo } from "./Logo";

/** Публичная текстовая страница (юр. документы, «О площадке»). draft — пометка «согласовать с юристом». */
export function LegalStub({ title, draft = true, children }: { title: string; draft?: boolean; children?: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[720px] px-4 py-6 sm:py-12">
      <Logo href="/login" />
      <h1 className="mt-8 font-display text-2xl leading-tight sm:text-3xl">{title}</h1>
      {draft && (
        <p className="mt-4 flex gap-2 rounded-[10px] bg-accent-soft px-4 py-3 text-sm text-accent">
          <TriangleAlert size={18} strokeWidth={1.75} className="mt-0.5 shrink-0" />
          Черновик. Текст-заглушка — окончательную редакцию согласовать с юристом.
        </p>
      )}
      <div className="legal mt-6 space-y-4 rounded-2xl border border-line bg-card p-5 leading-relaxed sm:p-8 [&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-lg [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">
        {children ?? <p className="text-muted">Текст готовится.</p>}
      </div>
      <FooterLinks className="mt-6" />
    </main>
  );
}
