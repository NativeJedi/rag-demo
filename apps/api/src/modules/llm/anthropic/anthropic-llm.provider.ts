import Anthropic from '@anthropic-ai/sdk';
import { Inject, Injectable } from '@nestjs/common';
import type { ChatEvent, StopReason } from '@chatbot/shared';
import { APP_CONFIG, type AppConfig } from '../../config/config.module';
import type { LlmProvider, LlmRequest } from '../llm-provider';

const MODEL = 'claude-haiku-5-5';
const MAX_TOKENS = 4096;

@Injectable()
export class AnthropicLlmProvider implements LlmProvider {
  private readonly client: Anthropic;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
  }

  async *stream(request: LlmRequest, signal: AbortSignal): AsyncGenerator<ChatEvent> {
    const stream = this.client.messages.stream(
      { model: MODEL, max_tokens: MAX_TOKENS, messages: request.messages },
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
