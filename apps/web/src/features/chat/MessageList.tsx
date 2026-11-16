import { useEffect, useRef } from 'react';
import type { Message } from '@chatbot/shared';
import { EmptyState } from './EmptyState';
import { AssistantMessage, UserMessage } from './MessageBubble';
import type { ChatState } from './chatReducer';

interface MessageListProps {
  messages: Message[];
  live: ChatState;
  onPickSample: (text: string) => void;
}

export function MessageList({ messages, live, onPickSample }: MessageListProps) {
  const scroller = useRef<HTMLDivElement>(null);

  // follow the reply as it streams in
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  });

  const empty = messages.length === 0 && !live.pendingUser && !live.message;

  return (
    <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto" data-testid="message-scroller">
      {empty ? (
        <EmptyState onPick={onPickSample} />
      ) : (
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
          {messages.map((m) =>
            m.role === 'user' ? (
              <UserMessage key={m.id} text={m.content} />
            ) : (
              <AssistantMessage key={m.id} text={m.content} stopReason={m.stopReason} />
            ),
          )}
          {live.pendingUser !== undefined && <UserMessage text={live.pendingUser} />}
          {(live.message || live.error) && (
            <AssistantMessage
              text={live.message?.text ?? ''}
              streaming={live.status === 'streaming'}
              stopReason={live.message?.stopReason}
              error={live.error}
            />
          )}
        </div>
      )}
    </div>
  );
}
