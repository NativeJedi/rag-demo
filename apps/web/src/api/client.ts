import { EventSourceParserStream } from 'eventsource-parser/stream';
import { z } from 'zod';
import {
  ApiErrorSchema,
  ChatEventSchema,
  ConversationSchema,
  ConversationSummarySchema,
  ConversationWithMessagesSchema,
  type ChatEvent,
  type Conversation,
  type ConversationSummary,
  type ConversationWithMessages,
  type SendMessageDto,
} from '@chatbot/shared';

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

async function toError(res: Response): Promise<ApiRequestError> {
  const parsed = ApiErrorSchema.safeParse(await res.json().catch(() => undefined));
  return parsed.success
    ? new ApiRequestError(parsed.data.error.message, res.status, parsed.data.error.code)
    : new ApiRequestError(`Request failed (${res.status})`, res.status, 'http_error');
}

async function request<S extends z.ZodType>(path: string, schema: S, init?: RequestInit): Promise<z.infer<S>> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { ...(init?.body ? { 'content-type': 'application/json' } : {}), ...init?.headers },
  });
  if (!res.ok) throw await toError(res);
  return schema.parse(await res.json());
}

export const api = {
  listConversations: (): Promise<ConversationSummary[]> => request('/conversations', z.array(ConversationSummarySchema)),
  getConversation: (id: string): Promise<ConversationWithMessages> =>
    request(`/conversations/${id}`, ConversationWithMessagesSchema),
  createConversation: (): Promise<Conversation> =>
    request('/conversations', ConversationSchema, { method: 'POST', body: '{}' }),
  deleteConversation: async (id: string): Promise<void> => {
    const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
    if (!res.ok) throw await toError(res);
  },
};

/**
 * POSTs a message and yields the assistant turn's events.
 * `fetch` + `ReadableStream` rather than `EventSource`, which cannot POST;
 * aborting `signal` closes the connection, which the server treats as Stop.
 */
export async function* streamMessage(
  conversationId: string,
  body: SendMessageDto,
  signal: AbortSignal,
): AsyncGenerator<ChatEvent> {
  const res = await fetch(`/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw await toError(res);
  if (!res.body) throw new ApiRequestError('Empty response body', res.status, 'no_body');

  const reader = res.body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new EventSourceParserStream())
    .getReader();

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      const parsed = ChatEventSchema.safeParse(safeJson(value.data));
      if (parsed.success) yield parsed.data;
      else console.warn('Ignoring malformed ChatEvent', value.event, parsed.error.message);
    }
  } finally {
    // closes the connection if the caller stops reading early
    await reader.cancel().catch(() => undefined);
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
