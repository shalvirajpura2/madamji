// doubts Ma'am promised to answer before the class ends

export function DoubtList({ doubts, current }: { doubts?: { text: string; answered: boolean }[]; current?: number }) {
  if (!doubts?.length) return null;
  return (
    <div className="paper-card flex flex-col gap-2 rounded-3xl p-4 animate-rise" data-tour="doubts">
      <p className="flex items-center justify-between text-xs font-bold tracking-wide text-ink-soft uppercase">
        <span>📌 Doubt list</span>
        <span>
          {doubts.filter((d) => d.answered).length}/{doubts.length} cleared
        </span>
      </p>
      <ol className="flex flex-col gap-1.5">
        {doubts.map((d, i) => (
          <li
            key={i}
            className={`flex gap-2 rounded-xl px-2 py-1.5 text-[15px] leading-snug ${
              i === current ? "bg-marigold/20 font-bold" : d.answered ? "text-ink-soft line-through" : ""
            }`}
          >
            <span aria-hidden>{d.answered ? "✓" : i === current ? "▶" : `${i + 1}.`}</span>
            <span>{d.text}</span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-ink-soft">Ma&apos;am will answer these before the class ends.</p>
    </div>
  );
}
