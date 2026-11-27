import type { ChatEvent } from '@chatbot/shared';

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

/** A piece of a message. Tool blocks join this union in the tool-loop step. */
export type ContentBlock = { type: 'text'; text: string };

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: ContentBlock[];
}

/** Our domain request shape. SDK mapping stays inside the provider that needs it. */
export interface LlmRequest {
  messages: LlmMessage[];
}

export interface LlmProvider {
  stream(request: LlmRequest, signal: AbortSignal): AsyncIterable<ChatEvent>;
}
