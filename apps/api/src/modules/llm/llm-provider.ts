import type { Block, ChatEvent, ModelAlias, StopReason, Usage } from '@chatbot/shared';

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

export interface LlmMessage {
  role: 'user' | 'assistant';
  blocks: Block[];
}

/** Our domain request shape. SDK mapping happens only inside AnthropicLlmProvider. */
export interface LlmRequest {
  messages: LlmMessage[];
  system?: string;
  temperature: number;
  maxTokens: number;
  model: ModelAlias;
  modelId: string;
}

export interface LlmResult {
  text: string;
  usage: Usage;
  stopReason: StopReason;
}

export interface LlmProvider {
  stream(request: LlmRequest, signal: AbortSignal): AsyncIterable<ChatEvent>;
  /** Non-streaming helper (titles, graders, routing). */
  complete(request: LlmRequest): Promise<LlmResult>;
}
