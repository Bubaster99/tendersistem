export function StubPage({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h1 className="font-display text-2xl sm:text-3xl">{title}</h1>
      <div className="mt-6 rounded-2xl border border-line bg-card p-6 text-muted">{text}</div>
    </div>
  );
}
