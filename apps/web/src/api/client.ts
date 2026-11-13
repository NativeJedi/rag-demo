import { z } from 'zod';
import {
  ApiErrorSchema,
  CapabilitiesSchema,
  ChatEventSchema,
  ConversationSchema,
  ConversationSummarySchema,
  ConversationWithMessagesSchema,
  type Capabilities,
  type ChatEvent,
  type Conversation,
  type ConversationSummary,
  type ConversationWithMessages,
  type SendMessageDto,
  type UpdateConversationDto,
} from '@chatbot/shared';
import { createSseParser } from './sse';

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
  capabilities: (): Promise<Capabilities> => request('/capabilities', CapabilitiesSchema),
  listConversations: (): Promise<ConversationSummary[]> => request('/conversations', z.array(ConversationSummarySchema)),
  getConversation: (id: string): Promise<ConversationWithMessages> =>
    request(`/conversations/${id}`, ConversationWithMessagesSchema),
  createConversation: (title?: string): Promise<Conversation> =>
    request('/conversations', ConversationSchema, { method: 'POST', body: JSON.stringify({ title }) }),
  updateConversation: (id: string, patch: UpdateConversationDto): Promise<Conversation> =>
    request(`/conversations/${id}`, ConversationSchema, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteConversation: async (id: string): Promise<void> => {
    const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
    if (!res.ok) throw await toError(res);
  },
};

/**
 * POST a message and read the SSE response with fetch + ReadableStream
 * (EventSource cannot POST). Aborting `signal` closes the connection, which the
 * server treats as Stop. Resolves when the stream ends; rejects on HTTP/network errors.
 */
export async function streamMessage(
  conversationId: string,
  body: SendMessageDto,
  signal: AbortSignal,
  onEvent: (event: ChatEvent) => void,
): Promise<void> {
  const res = await fetch(`/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw await toError(res);
  if (!res.body) throw new ApiRequestError('Empty response body', res.status, 'no_body');

  const parser = createSseParser((frame) => {
    const parsed = ChatEventSchema.safeParse(safeJson(frame.data));
    if (parsed.success) onEvent(parsed.data);
    else console.warn('Ignoring malformed ChatEvent', frame.event, parsed.error.message);
  });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.push(decoder.decode(value, { stream: true }));
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
