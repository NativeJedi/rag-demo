import type { StopReason } from '@chatbot/shared';
import { cn } from '../../lib/cn';
import { Markdown } from './Markdown';
import type { StreamError } from './chatReducer';

export function UserMessage({ text }: { text: string }) {
  return (
    <div className="flex justify-end" data-testid="user-message">
      <div className="max-w-[75%] whitespace-pre-wrap break-words rounded-2xl bg-user px-4 py-2.5">{text}</div>
    </div>
  );
}

interface AssistantMessageProps {
  text: string;
  streaming?: boolean;
  stopReason?: StopReason;
  error?: StreamError;
}

export function AssistantMessage({ text, streaming = false, stopReason, error }: AssistantMessageProps) {
  return (
    <div data-testid="assistant-message">
      {text ? (
        <div className={cn(streaming && 'caret')}>
          <Markdown text={text} />
        </div>
      ) : (
        streaming && <div className="caret h-6 text-muted" aria-label="Waiting for reply" />
      )}

      {error && (
        <div role="alert" className="mt-3 rounded-xl border border-danger/50 bg-danger/10 px-3 py-2 text-sm text-danger">
          <div className="font-medium">{error.message}</div>
          <div className="text-xs opacity-80">{error.code}</div>
        </div>
      )}

      {stopReason === 'aborted' && (
        <div className="mt-2 text-xs text-accent" data-testid="message-footer">
          Stopped by you
        </div>
      )}
    </div>
  );
}
