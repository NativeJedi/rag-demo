import { useEffect, useRef, useState } from 'react';
import { Check, MessageSquare, PanelLeftClose, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { ConversationSummary } from '@chatbot/shared';
import { Button, IconButton } from '../../components/Button';
import { ConfirmDialog } from '../../components/Dialog';
import { Spinner } from '../../components/Spinner';
import { cn } from '../../lib/cn';

interface SidebarProps {
  conversations: ConversationSummary[] | undefined;
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onCollapse: () => void;
}

export function Sidebar({ conversations, loading, selectedId, onSelect, onNew, onRename, onDelete, onCollapse }: SidebarProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ConversationSummary | null>(null);

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex items-center gap-2 p-3">
        <Button variant="primary" className="flex-1" onClick={onNew}>
          <Plus className="size-4" /> New chat
        </Button>
        <IconButton label="Hide sidebar" onClick={onCollapse}>
          <PanelLeftClose className="size-5" />
        </IconButton>
      </div>
      <nav aria-label="Conversations" className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {loading && <div className="flex justify-center p-4"><Spinner /></div>}
        <ul className="space-y-0.5">
          {conversations?.map((c) =>
            renamingId === c.id ? (
              <RenameRow
                key={c.id}
                initial={c.title}
                onCancel={() => setRenamingId(null)}
                onSave={(title) => {
                  setRenamingId(null);
                  if (title && title !== c.title) onRename(c.id, title);
                }}
              />
            ) : (
              <li key={c.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  aria-current={c.id === selectedId ? 'page' : undefined}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-3 py-2 pr-16 text-left text-sm transition hover:bg-surface-2',
                    c.id === selectedId && 'bg-surface-2 font-medium',
                  )}
                >
                  <MessageSquare className="size-4 shrink-0 text-muted" />
                  <span className="truncate">{c.title}</span>
                </button>
                <div className="absolute right-1 top-1/2 flex -translate-y-1/2 gap-0.5 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100">
                  <IconButton label={`Rename ${c.title}`} className="size-7" onClick={() => setRenamingId(c.id)}>
                    <Pencil className="size-3.5" />
                  </IconButton>
                  <IconButton label={`Delete ${c.title}`} className="size-7" onClick={() => setDeleting(c)}>
                    <Trash2 className="size-3.5" />
                  </IconButton>
                </div>
              </li>
            ),
          )}
        </ul>
      </nav>
      {deleting && (
        <ConfirmDialog
          title="Delete conversation?"
          confirmLabel="Delete"
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            onDelete(deleting.id);
            setDeleting(null);
          }}
        >
          “{deleting.title}” and all its messages will be removed.
        </ConfirmDialog>
      )}
    </div>
  );
}

function RenameRow({ initial, onSave, onCancel }: { initial: string; onSave: (title: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.select(), []);
  return (
    <li className="flex items-center gap-1 px-1 py-0.5">
      <input
        ref={ref}
        value={value}
        aria-label="Conversation title"
        maxLength={200}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave(value.trim());
          if (e.key === 'Escape') onCancel();
        }}
        className="h-8 min-w-0 flex-1 rounded-md border border-accent bg-bg px-2 text-sm outline-none"
      />
      <IconButton label="Save title" className="size-7" onClick={() => onSave(value.trim())}>
        <Check className="size-4" />
      </IconButton>
      <IconButton label="Cancel rename" className="size-7" onClick={onCancel}>
        <X className="size-4" />
      </IconButton>
    </li>
  );
}
