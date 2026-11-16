const SAMPLES = [
  { text: 'Hello! Show me some markdown', hint: 'Formatted reply' },
  { text: 'Explain streaming in one paragraph', hint: 'Short answer' },
];

export function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="grid w-full gap-2 sm:grid-cols-2">
        {SAMPLES.map((s) => (
          <button
            key={s.text}
            type="button"
            onClick={() => onPick(s.text)}
            className="rounded-xl border border-line bg-surface px-4 py-3 text-left text-sm transition hover:border-accent"
          >
            <div className="font-medium">{s.text}</div>
            <div className="mt-0.5 text-xs text-muted">{s.hint}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
