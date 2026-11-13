import { AlertCircle, Sparkles } from 'lucide-react';
import type { StopReason, Usage } from '@chatbot/shared';
import { CitationChips } from './CitationChips';
import { Markdown } from './Markdown';
import { MessageFooter } from './MessageFooter';
import type { Part } from './parts';
import { ThinkingPanel } from './ThinkingPanel';
import { ToolCallCard } from './ToolCallCard';
import type { StreamError } from './chatReducer';
import { cn } from '../../lib/cn';

export function UserMessage({ text }: { text: string }) {
  return (
    <div className="flex justify-end" data-testid="user-message">
      <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-user px-4 py-2.5 sm:max-w-[75%]">{text}</div>
    </div>
  );
}

interface AssistantMessageProps {
  parts: Part[];
  streaming?: boolean;
  stopReason?: StopReason;
  usage?: Usage;
  model?: string;
  error?: StreamError;
}

export function AssistantMessage({ parts, streaming = false, stopReason, usage, model, error }: AssistantMessageProps) {
  const lastIndex = parts.length - 1;
  return (
    <div className="flex gap-3" data-testid="assistant-message">
      <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg">
        <Sparkles className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        {parts.length === 0 && streaming && <div className="caret h-6 text-muted" aria-label="Waiting for reply" />}
        {parts.map((part, i) => {
          const isLast = i === lastIndex;
          switch (part.kind) {
            case 'text':
              return (
                <div key={i} className={cn(streaming && isLast && 'caret')}>
                  <Markdown text={part.text} />
                  <CitationChips citations={part.citations} />
                </div>
              );
            case 'thinking':
              return <ThinkingPanel key={i} text={part.text} streaming={streaming && isLast} />;
            case 'tool':
              return <ToolCallCard key={part.toolUseId} part={part} />;
          }
        })}
        {error && (
          <div role="alert" className="my-3 flex items-start gap-2 rounded-xl border border-danger/50 bg-danger/10 px-3 py-2 text-sm text-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <div>
              <div className="font-medium">{error.message}</div>
              <div className="text-xs opacity-80">
                {error.code}
                {error.retryable ? ' · you can send the message again' : ''}
              </div>
            </div>
          </div>
        )}
        {!streaming && <MessageFooter stopReason={stopReason} usage={usage} model={model} />}
      </div>
    </div>
  );
}
