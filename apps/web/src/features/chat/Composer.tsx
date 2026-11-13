import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowUp, AtSign, Paperclip, Slash, Square } from 'lucide-react';
import { IconButton } from '../../components/Button';
import { useCapabilities } from '../../lib/capabilities';
import { cn } from '../../lib/cn';

interface ComposerProps {
  streaming: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  /** Text injected from outside (sample prompt click); consumed once per `nonce`. */
  prefill?: { text: string; nonce: number };
}

export function Composer({ streaming, onSend, onStop, prefill }: ComposerProps) {
  const { features } = useCapabilities();
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (prefill) {
      setValue(prefill.text);
      ref.current?.focus();
    }
  }, [prefill]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [value]);

  const submit = () => {
    const text = value.trim();
    if (!text || streaming) return;
    onSend(text);
    setValue('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const insert = (char: string) => {
    setValue((v) => v + char);
    ref.current?.focus();
  };

  return (
    <div className="border-t border-line bg-bg px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-end gap-1 rounded-2xl border border-line bg-surface p-2 shadow-sm focus-within:border-accent">
          <IconButton
            label="Attach file"
            disabled={!features.attachments}
            title={features.attachments ? 'Attach file' : 'Attachments are not available yet'}
          >
            <Paperclip className="size-5" />
          </IconButton>
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Message the assistant…"
            title="Enter to send, Shift+Enter for a new line"
            aria-label="Message"
            className="max-h-56 min-h-9 flex-1 resize-none bg-transparent px-1 py-2 text-base outline-none placeholder:text-muted sm:text-sm"
          />
          <div className="hidden sm:flex">
            <IconButton
              label="Mention a resource"
              disabled={!features.mcp}
              title={features.mcp ? 'Mention a resource' : '@ mentions need MCP (not available yet)'}
              onClick={() => insert('@')}
            >
              <AtSign className="size-5" />
            </IconButton>
            <IconButton
              label="Run a command"
              disabled={!features.mcp}
              title={features.mcp ? 'Run a command' : '/ commands need MCP (not available yet)'}
              onClick={() => insert('/')}
            >
              <Slash className="size-5" />
            </IconButton>
          </div>
          {streaming ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-fg text-bg transition hover:opacity-80"
            >
              <Square className="size-4 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!value.trim()}
              aria-label="Send"
              className={cn(
                'inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-fg transition',
                'hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40',
              )}
            >
              <ArrowUp className="size-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
