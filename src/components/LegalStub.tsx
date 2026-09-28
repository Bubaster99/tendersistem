import { Logo } from "./Logo";

export function LegalStub({ title }: { title: string }) {
  return (
    <main className="mx-auto w-full max-w-[720px] px-4 py-6 sm:py-12">
      <Logo />
      <h1 className="mt-8 font-display text-2xl sm:text-3xl">{title}</h1>
      <div className="mt-6 rounded-2xl border border-line bg-card p-6 text-muted">Текст готовится.</div>
    </main>
  );
}
