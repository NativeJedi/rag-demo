import type { ConversationSummary } from '@chatbot/shared';
import { cn } from '../../lib/cn';

interface SidebarProps {
  conversations: ConversationSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export function Sidebar({ conversations, selectedId, onSelect, onNew, onDelete }: SidebarProps) {
  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r border-line bg-surface">
      <div className="p-3">
        <button
          type="button"
          onClick={onNew}
          className="h-9 w-full rounded-lg bg-accent text-sm font-medium text-accent-fg transition hover:opacity-90"
        >
          New chat
        </button>
      </div>

      <nav aria-label="Conversations" className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <ul className="space-y-0.5">
          {conversations.map((c) => (
            <li key={c.id} className="group relative">
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                aria-current={c.id === selectedId ? 'page' : undefined}
                className={cn(
                  'w-full truncate rounded-lg px-3 py-2 pr-9 text-left text-sm transition hover:bg-surface-2',
                  c.id === selectedId && 'bg-surface-2 font-medium',
                )}
              >
                {c.title}
              </button>
              <button
                type="button"
                onClick={() => onDelete(c.id)}
                aria-label={`Delete ${c.title}`}
                className="absolute right-1 top-1/2 size-7 -translate-y-1/2 rounded-md text-muted opacity-0 transition hover:text-fg group-hover:opacity-100"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
