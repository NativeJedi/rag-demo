import { useState, type KeyboardEvent } from 'react';

interface ComposerProps {
  streaming: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}

export function Composer({ streaming, onSend, onStop }: ComposerProps) {
  const [value, setValue] = useState('');

  const submit = () => {
    const text = value.trim();
    if (!text || streaming) return;
    onSend(text);
    setValue('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="border-t border-line p-3">
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="Message the assistant…"
          aria-label="Message"
          className="max-h-40 flex-1 resize-none rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
        {streaming ? (
          <button
            type="button"
            onClick={onStop}
            className="h-9 rounded-lg bg-fg px-4 text-sm font-medium text-bg transition hover:opacity-80"
          >
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!value.trim()}
            className="h-9 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg transition hover:opacity-90 disabled:opacity-40"
          >
            Send
          </button>
        )}
      </div>
    </div>
  );
}
