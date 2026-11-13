import { Sparkles } from 'lucide-react';
import { useCapabilities } from '../../lib/capabilities';

const REAL_SAMPLES = ['Explain how server-sent events work', 'Write a TypeScript debounce function', 'Give me a 3-day plan to learn Rust'];
const MOCK_SAMPLES = [
  { text: '/mock thinking', hint: 'Collapsible thinking panel' },
  { text: '/mock tools', hint: 'Tool call cards, one failing' },
  { text: '/mock citations', hint: 'Citation chips with popovers' },
  { text: '/mock long', hint: '~2,000 words: scroll and Stop' },
  { text: '/mock error', hint: 'Error mid-stream' },
  { text: 'Hello! Show me markdown', hint: 'Default echo with markdown' },
];

export function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  const { provider } = useCapabilities();
  const samples =
    provider === 'mock' ? MOCK_SAMPLES : REAL_SAMPLES.map((text) => ({ text, hint: '' }));
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center px-4 py-10 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-fg">
        <Sparkles className="size-6" />
      </div>
      <h2 className="text-2xl font-semibold">How can I help?</h2>
      <p className="mt-1 text-sm text-muted">
        {provider === 'mock'
          ? 'Running on the mock provider. Pick a scenario to see every message type.'
          : 'Ask anything, or start from an example.'}
      </p>
      <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
        {samples.map((s) => (
          <button
            key={s.text}
            type="button"
            onClick={() => onPick(s.text)}
            className="rounded-xl border border-line bg-surface px-4 py-3 text-left text-sm transition hover:border-accent hover:bg-surface-2"
          >
            <div className={s.text.startsWith('/mock') ? 'font-mono' : 'font-medium'}>{s.text}</div>
            {s.hint && <div className="mt-0.5 text-xs text-muted">{s.hint}</div>}
          </button>
        ))}
      </div>
    </div>
  );
}
