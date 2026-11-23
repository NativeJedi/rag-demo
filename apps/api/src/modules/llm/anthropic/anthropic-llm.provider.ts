import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { Inject, Injectable } from '@nestjs/common';
import type { ChatEvent, StopReason } from '@chatbot/shared';
import { APP_CONFIG, type AppConfig } from '../../config/config.module';
import type { LlmProvider, LlmRequest } from '../llm-provider';

const MODEL = 'claude-haiku-5-5';
const MAX_TOKENS = 4096;
// same depth from src/ and dist/: apps/api/prompts/
const PROMPTS_DIR = join(__dirname, '..', '..', '..', '..', 'prompts');

@Injectable()
export class AnthropicLlmProvider implements LlmProvider {
  private readonly client: Anthropic;
  private readonly systemPrompt: string;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
    this.systemPrompt = readFileSync(join(PROMPTS_DIR, config.SYSTEM_PROMPT_FILE), 'utf8').trim();
  }

  async *stream(request: LlmRequest, signal: AbortSignal): AsyncGenerator<ChatEvent> {
    const stream = this.client.messages.stream(
      { model: MODEL, max_tokens: MAX_TOKENS, messages: request.messages, system: this.systemPrompt },
      { signal },
    );
    let stopReason: StopReason;
    try {
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield { type: 'text_delta', text: event.delta.text };
        }
      }
      const message = await stream.finalMessage();
      stopReason = message.stop_reason === 'max_tokens' ? 'max_tokens' : 'end_turn';
    } catch (err) {
      if (signal.aborted) return; // Stop button: ChatService records the abort
      throw err;
    }
    yield { type: 'message_done', stopReason };
  }
}
