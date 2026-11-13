import { useCallback, useSyncExternalStore } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ConversationSummary, UpdateConversationDto } from '@chatbot/shared';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';

export function useConversationList() {
  return useQuery({ queryKey: queryKeys.conversations, queryFn: api.listConversations });
}

export function useConversation(id: string) {
  return useQuery({ queryKey: queryKeys.conversation(id), queryFn: () => api.getConversation(id), retry: false });
}

export function useConversationMutations() {
  const qc = useQueryClient();
  const refresh = (id?: string) => {
    void qc.invalidateQueries({ queryKey: queryKeys.conversations });
    if (id) void qc.invalidateQueries({ queryKey: queryKeys.conversation(id) });
  };
  return {
    create: useMutation({
      mutationFn: () => api.createConversation(),
      onSuccess: ({ id, title, updatedAt }) => {
        // seed the list right away so the "ensure a selection" effect never sees a stale, empty list
        qc.setQueryData<ConversationSummary[]>(queryKeys.conversations, (old) => [{ id, title, updatedAt }, ...(old ?? [])]);
        refresh();
      },
    }),
    update: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: UpdateConversationDto }) => api.updateConversation(id, patch),
      onSuccess: (_data, { id }) => refresh(id),
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.deleteConversation(id),
      onSuccess: (_data, id) => {
        qc.removeQueries({ queryKey: queryKeys.conversation(id) });
        refresh();
      },
    }),
  };
}

/** The selected conversation lives in the URL hash (`#/c/<id>`), so reloads and back/forward work. */
function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}
const getSnapshot = () => /^#\/c\/(.+)$/.exec(window.location.hash)?.[1] ?? null;

export function useSelectedConversationId(): [string | null, (id: string | null) => void] {
  const id = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const select = useCallback((next: string | null) => {
    window.location.hash = next ? `/c/${next}` : '';
  }, []);
  return [id, select];
}
