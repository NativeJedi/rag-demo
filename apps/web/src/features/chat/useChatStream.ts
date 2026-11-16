import { useCallback, useEffect, useReducer, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiRequestError, streamMessage } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { chatReducer, initialChatState } from './chatReducer';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Owns one in-flight stream for a conversation; unmounting (switching chats) aborts it. */
export function useChatStream(conversationId: string) {
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const queryClient = useQueryClient();
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  /** Pull the persisted turn into the cache, then drop the live copy. */
  const sync = useCallback(
    async (expectedMessages: number | null) => {
      const attempts = expectedMessages === null ? 1 : 8;
      for (let i = 0; i < attempts; i++) {
        const data = await queryClient.fetchQuery({
          queryKey: queryKeys.conversation(conversationId),
          queryFn: () => api.getConversation(conversationId),
          staleTime: 0,
        });
        if (expectedMessages === null || data.messages.length >= expectedMessages) break;
        await sleep(250); // the server persists a stopped reply just after it notices the disconnect
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
      dispatch({ type: 'reset' });
    },
    [conversationId, queryClient],
  );

  const send = useCallback(
    async (content: string, persistedCount: number) => {
      const ac = new AbortController();
      controller.current = ac;
      dispatch({ type: 'send', text: content });
      try {
        for await (const event of streamMessage(conversationId, { content }, ac.signal)) {
          dispatch({ type: 'event', event });
        }
        dispatch({ type: 'finish' });
        await sync(null);
      } catch (err) {
        if (ac.signal.aborted) {
          dispatch({ type: 'abort' });
          await sync(persistedCount + 2); // the user message and the partial reply
        } else {
          const message = err instanceof ApiRequestError ? err.message : 'Network error: could not reach the API.';
          dispatch({ type: 'fail', error: { code: 'request_failed', message } });
          await sync(null).catch(() => undefined);
        }
      } finally {
        if (controller.current === ac) controller.current = null;
      }
    },
    [conversationId, sync],
  );

  const stop = useCallback(() => controller.current?.abort(), []);

  return { state, send, stop };
}
