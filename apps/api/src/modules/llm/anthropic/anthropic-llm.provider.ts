import type { ChatEvent } from '@chatbot/shared';
import type { LlmProvider, LlmRequest, LlmResult } from '../llm-provider';

/** Stub — the real implementation (and the only @anthropic-ai/sdk import) lands in phase 2. */
export class AnthropicLlmProvider implements LlmProvider {
  // eslint-disable-next-line require-yield
  async *stream(_request: LlmRequest, _signal: AbortSignal): AsyncGenerator<ChatEvent> {
    throw new Error('AnthropicLlmProvider is not implemented: planned for phase 2');
  }

  async complete(_request: LlmRequest): Promise<LlmResult> {
    throw new Error('AnthropicLlmProvider is not implemented: planned for phase 2');
  }
}
