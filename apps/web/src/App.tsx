import { useEffect, useRef, useState } from 'react';
import { ChatView } from './features/chat/ChatView';
import { Sidebar } from './features/conversations/Sidebar';
import { useConversationList, useConversationMutations } from './features/conversations/hooks';

export function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: conversations } = useConversationList();
  const { create, remove } = useConversationMutations();

  const newChat = () => create.mutate(undefined, { onSuccess: (c) => setSelectedId(c.id) });

  // start the demo with one chat ready to type in
  const createdFirst = useRef(false);
  useEffect(() => {
    if (conversations?.length === 0 && !createdFirst.current) {
      createdFirst.current = true;
      newChat();
    }
  }, [conversations]); // eslint-disable-line react-hooks/exhaustive-deps

  // a deleted chat falls back to the newest one
  const selected = conversations?.find((c) => c.id === selectedId) ?? conversations?.[0];

  return (
    <div className="flex h-full">
      <Sidebar
        conversations={conversations ?? []}
        selectedId={selected?.id ?? null}
        onSelect={setSelectedId}
        onNew={newChat}
        onDelete={(id) => remove.mutate(id)}
      />
      {/* keyed by id: switching chats aborts the running stream and resets the reducer */}
      {selected && <ChatView key={selected.id} conversationId={selected.id} title={selected.title} />}
    </div>
  );
}
