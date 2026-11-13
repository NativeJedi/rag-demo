import { useState } from 'react';
import { PanelLeft, SlidersHorizontal } from 'lucide-react';
import { IconButton } from '../../components/Button';
import { Spinner } from '../../components/Spinner';
import { ThemeToggle } from '../../components/ThemeToggle';
import { useConversation, useConversationMutations } from '../conversations/hooks';
import { ModelSelect } from '../settings/ModelSelect';
import { SettingsDrawer } from '../settings/SettingsDrawer';
import { UsageBadge } from '../settings/UsageBadge';
import { Composer } from './Composer';
import { MessageList } from './MessageList';
import { useChatStream } from './useChatStream';

interface ChatViewProps {
  conversationId: string;
  sidebarHidden: boolean;
  onOpenSidebar: () => void;
}

/** Mounted with `key={conversationId}`: switching chats aborts the stream and resets state. */
export function ChatView({ conversationId, sidebarHidden, onOpenSidebar }: ChatViewProps) {
  const { data: conversation, isPending } = useConversation(conversationId);
  const { update } = useConversationMutations();
  const { state, send, stop } = useChatStream(conversationId);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sendCount, setSendCount] = useState(0);
  const [prefill, setPrefill] = useState<{ text: string; nonce: number }>();

  const streaming = state.status === 'streaming';
  const messages = conversation?.messages ?? [];

  const handleSend = (text: string) => {
    setSendCount((n) => n + 1);
    void send(text, messages.length);
  };

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-3">
        {sidebarHidden && (
          <IconButton label="Show sidebar" onClick={onOpenSidebar}>
            <PanelLeft className="size-5" />
          </IconButton>
        )}
        <h1 className="min-w-0 flex-1 truncate text-sm font-semibold sm:text-base" data-testid="conversation-title">
          {conversation?.title ?? ' '}
        </h1>
        <UsageBadge messages={messages} />
        {conversation && (
          <ModelSelect value={conversation.settings.model} onChange={(model) => update.mutate({ id: conversationId, patch: { settings: { model } } })} />
        )}
        <IconButton label="Conversation settings" onClick={() => setSettingsOpen(true)} disabled={!conversation}>
          <SlidersHorizontal className="size-5" />
        </IconButton>
        <ThemeToggle />
      </header>

      {isPending ? (
        <div className="flex flex-1 items-center justify-center"><Spinner /></div>
      ) : (
        <MessageList
          messages={messages}
          live={state}
          sendCount={sendCount}
          onPickSample={(text) => setPrefill({ text, nonce: Date.now() })}
        />
      )}

      <Composer streaming={streaming} onSend={handleSend} onStop={stop} prefill={prefill} />

      {conversation && (
        <SettingsDrawer
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          conversation={conversation}
          onSave={(settings) => update.mutate({ id: conversationId, patch: { settings } })}
        />
      )}
    </div>
  );
}
