import { Quote } from 'lucide-react';
import type { Citation } from '@chatbot/shared';
import { Popover } from '../../components/Popover';

/** Numbered chips under a text block; each opens the cited text and its source. */
export function CitationChips({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) return null;
  return (
    <div className="-mt-1 mb-3 flex flex-wrap gap-1.5" aria-label="Citations">
      {citations.map((c, i) => (
        <Popover
          key={i}
          trigger={({ onClick, open }) => (
            <button
              type="button"
              onClick={onClick}
              aria-expanded={open}
              className="inline-flex max-w-56 items-center gap-1 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-xs text-muted hover:text-fg"
            >
              <span className="font-semibold text-accent">{i + 1}</span>
              <span className="truncate">{c.source.title}</span>
            </button>
          )}
        >
          <div className="mb-2 flex items-start gap-2">
            <Quote className="mt-0.5 size-4 shrink-0 text-accent" />
            <blockquote className="italic">{c.citedText}</blockquote>
          </div>
          <div className="border-t border-line pt-2 text-xs text-muted">
            <div className="font-medium text-fg">{c.source.title}</div>
            <div className="capitalize">{c.source.kind}</div>
            {/^https?:\/\//.test(c.source.ref) ? (
              <a className="break-all text-accent underline" href={c.source.ref} target="_blank" rel="noreferrer noopener">
                {c.source.ref}
              </a>
            ) : (
              <code className="break-all">{c.source.ref}</code>
            )}
          </div>
        </Popover>
      ))}
    </div>
  );
}
