export default function ScreenHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="mb-8">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand">{subtitle}</p>
      <h1 className="mt-2 text-4xl font-extrabold uppercase tracking-tight">{title}</h1>
    </header>
  );
}
