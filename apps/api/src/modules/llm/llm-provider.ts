import type { ChatEvent } from '@chatbot/shared';

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Our domain request shape. SDK mapping stays inside the provider that needs it. */
export interface LlmRequest {
  messages: LlmMessage[];
}

export interface LlmProvider {
  stream(request: LlmRequest, signal: AbortSignal): AsyncIterable<ChatEvent>;
}
