import { useEffect, useMemo } from 'react';
import { ArrowDown } from 'lucide-react';
import type { Message } from '@chatbot/shared';
import { Button } from '../../components/Button';
import { EmptyState } from './EmptyState';
import { AssistantMessage, UserMessage } from './MessageBubble';
import type { ChatState } from './chatReducer';
import { blocksToParts } from './parts';
import { useAutoScroll } from './useAutoScroll';

interface MessageListProps {
  messages: Message[];
  live: ChatState;
  onPickSample: (text: string) => void;
  /** Bumped by the parent on each send so the list re-pins to the bottom. */
  sendCount: number;
}

export function MessageList({ messages, live, onPickSample, sendCount }: MessageListProps) {
  const { scroller, content, showJump, jumpToLatest, pin } = useAutoScroll();
  useEffect(() => {
    if (sendCount > 0) pin();
  }, [sendCount, pin]);

  const persisted = useMemo(
    () =>
      messages.map((m) =>
        m.role === 'user' ? (
          <UserMessage key={m.id} text={m.blocks.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n')} />
        ) : (
          <AssistantMessage key={m.id} parts={blocksToParts(m.blocks)} stopReason={m.stopReason} usage={m.usage} model={m.model} />
        ),
      ),
    [messages],
  );

  const empty = messages.length === 0 && !live.pendingUser && !live.message;

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={scroller} className="h-full overflow-y-auto" data-testid="message-scroller">
        {empty ? (
          <EmptyState onPick={onPickSample} />
        ) : (
          <div ref={content} className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
            {persisted}
            {live.pendingUser !== undefined && <UserMessage text={live.pendingUser} />}
            {(live.message || live.error) && (
              <AssistantMessage
                parts={live.message?.parts ?? []}
                streaming={live.status === 'streaming'}
                stopReason={live.message?.stopReason}
                usage={live.message?.usage}
                model={live.message?.model}
                error={live.error}
              />
            )}
          </div>
        )}
      </div>
      {showJump && (
        <Button variant="secondary" onClick={jumpToLatest} className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full shadow-md">
          <ArrowDown className="size-4" /> Jump to latest
        </Button>
      )}
    </div>
  );
}

