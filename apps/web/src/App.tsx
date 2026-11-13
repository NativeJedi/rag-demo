import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatView } from './features/chat/ChatView';
import { useConversationList, useConversationMutations, useSelectedConversationId } from './features/conversations/hooks';
import { Sidebar } from './features/conversations/Sidebar';
import { cn } from './lib/cn';

const isDesktop = () => window.matchMedia('(min-width: 768px)').matches;

export function App() {
  const [selectedId, select] = useSelectedConversationId();
  const { data: conversations, isPending } = useConversationList();
  const { create, update, remove } = useConversationMutations();
  const [sidebarOpen, setSidebarOpen] = useState(isDesktop);
  const creating = useRef(false);

  const newChat = useCallback(() => {
    if (creating.current) return;
    creating.current = true;
    create.mutate(undefined, {
      onSuccess: (c) => select(c.id),
      onSettled: () => (creating.current = false),
    });
  }, [create, select]);

  // Always have a valid selection: fall back to the newest chat, or make one.
  const knownIds = conversations?.map((c) => c.id);
  useEffect(() => {
    if (!knownIds) return;
    if (selectedId && knownIds.includes(selectedId)) return;
    const newest = knownIds[0];
    if (newest) select(newest);
    else newChat();
  }, [knownIds?.join(','), selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (id: string) => {
    select(id);
    if (!isDesktop()) setSidebarOpen(false);
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* mobile backdrop */}
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside
        className={cn(
          'z-40 h-full w-72 shrink-0 border-r border-line transition-[margin,transform] duration-200',
          'max-md:fixed max-md:left-0 max-md:top-0',
          sidebarOpen ? 'translate-x-0' : 'max-md:-translate-x-full md:-ml-72',
        )}
        aria-hidden={!sidebarOpen}
        inert={!sidebarOpen}
      >
        <Sidebar
          conversations={conversations}
          loading={isPending}
          selectedId={selectedId}
          onSelect={choose}
          onNew={() => {
            newChat();
            if (!isDesktop()) setSidebarOpen(false);
          }}
          onRename={(id, title) => update.mutate({ id, patch: { title } })}
          onDelete={(id) => remove.mutate(id)}
          onCollapse={() => setSidebarOpen(false)}
        />
      </aside>
      {selectedId && knownIds?.includes(selectedId) ? (
        <ChatView
          key={selectedId}
          conversationId={selectedId}
          sidebarHidden={!sidebarOpen}
          onOpenSidebar={() => setSidebarOpen(true)}
        />
      ) : (
        <div className="flex-1" />
      )}
    </div>
  );
}
