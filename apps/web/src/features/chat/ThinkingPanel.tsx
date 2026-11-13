import { useState } from 'react';
import { Brain, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/cn';

export function ThinkingPanel({ text, streaming }: { text: string; streaming: boolean }) {
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const open = userOpen ?? streaming; // open while thinking, collapsed afterwards unless toggled
  return (
    <div className="my-3 rounded-xl border border-line bg-surface-2/60">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setUserOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted hover:text-fg"
      >
        <ChevronRight className={cn('size-4 transition-transform', open && 'rotate-90')} />
        <Brain className="size-4" />
        <span className="font-medium">{streaming ? 'Thinking…' : 'Thinking'}</span>
      </button>
      {open && <p className="whitespace-pre-wrap border-t border-line px-4 py-3 text-sm italic leading-relaxed text-muted">{text}</p>}
    </div>
  );
}
