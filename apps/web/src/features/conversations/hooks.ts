import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  const refreshList = () => void qc.invalidateQueries({ queryKey: queryKeys.conversations });
  return {
    create: useMutation({ mutationFn: () => api.createConversation(), onSuccess: refreshList }),
    remove: useMutation({
      mutationFn: (id: string) => api.deleteConversation(id),
      onSuccess: (_data, id) => {
        qc.removeQueries({ queryKey: queryKeys.conversation(id) });
        refreshList();
      },
    }),
  };
}
