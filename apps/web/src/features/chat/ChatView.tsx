import { useConversation } from '../conversations/hooks';
import { Composer } from './Composer';
import { MessageList } from './MessageList';
import { useChatStream } from './useChatStream';

/** One conversation: its messages, the live stream and the composer. */
export function ChatView({ conversationId, title }: { conversationId: string; title: string }) {
  const { data: conversation } = useConversation(conversationId);
  const { state, send, stop } = useChatStream(conversationId);
  const messages = conversation?.messages ?? [];

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center border-b border-line px-4">
        <h1 className="truncate font-semibold" data-testid="conversation-title">
          {title}
        </h1>
      </header>

      <MessageList messages={messages} live={state} onPickSample={(text) => void send(text, messages.length)} />

      <Composer
        streaming={state.status === 'streaming'}
        onSend={(text) => void send(text, messages.length)}
        onStop={stop}
      />
    </div>
  );
}
