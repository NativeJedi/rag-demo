import type Anthropic from '@anthropic-ai/sdk';
import type { ChatEvent, StopReason } from '@chatbot/shared';
import type { LlmProvider, LlmRequest } from '../llm-provider';

const MAX_TOKENS = 4096;

export class AnthropicLlmProvider implements LlmProvider {
  constructor(
    private readonly client: Pick<Anthropic, 'messages'>,
    private readonly model: string,
  ) {}

  async *stream(request: LlmRequest, signal: AbortSignal): AsyncGenerator<ChatEvent> {
    const stream = this.client.messages.stream(
      { model: this.model, max_tokens: MAX_TOKENS, messages: request.messages },
      { signal },
    );
    let stopReason: StopReason = 'end_turn';
    try {
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield { type: 'text_delta', text: event.delta.text };
        } else if (event.type === 'message_delta' && event.delta.stop_reason === 'max_tokens') {
          stopReason = 'max_tokens';
        }
      }
    } catch (err) {
      if (signal.aborted) return; // Stop button: ChatService records the abort
      throw err;
    }
    yield { type: 'message_done', stopReason };
  }
}
