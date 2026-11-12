export default function Placeholder({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-panel p-6">
      <p className="text-sm font-semibold uppercase tracking-widest text-neutral-400">Coming soon</p>
      <p className="mt-2 text-neutral-300">{text}</p>
    </div>
  );
}
