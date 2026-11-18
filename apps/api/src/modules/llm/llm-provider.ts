import type { ChatEvent } from '@chatbot/shared';
import type { ZodType } from 'zod';

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Our domain request shape. SDK mapping stays inside the provider that needs it. */
export interface LlmRequest {
  messages: LlmMessage[];
  /** Overrides the default system prompt (used by the eval generator and judge). */
  system?: string;
}

export interface LlmProvider {
  stream(request: LlmRequest, signal: AbortSignal): AsyncIterable<ChatEvent>;
  /** One request, the whole text reply (no streaming). */
  complete(request: LlmRequest): Promise<string>;
  /** Like complete(), but the model is constrained to the schema and the result is parsed and typed. */
  completeJson<T>(request: LlmRequest, schema: ZodType<T>): Promise<T>;
}
