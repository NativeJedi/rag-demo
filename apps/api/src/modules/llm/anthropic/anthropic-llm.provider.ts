import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { Inject, Injectable } from '@nestjs/common';
import type { StopReason } from '@chatbot/shared';
import { APP_CONFIG, type AppConfig } from '../../config/config.module';
import type { ContentBlock, LlmEvent, LlmMessage, LlmProvider, LlmRequest, ToolDefinition } from '../llm-provider';

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

  async *stream(request: LlmRequest, signal: AbortSignal): AsyncGenerator<LlmEvent> {
    const stream = this.client.messages.stream(
      {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: request.messages.map(toSdkMessage),
        system: this.systemPrompt,
        ...(request.tools?.length && { tools: request.tools.map(toSdkTool) }),
      },
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
      if (message.stop_reason === 'tool_use') {
        const blocks = message.content.flatMap((b) =>
          b.type === 'tool_use' ? [{ type: 'tool_use' as const, id: b.id, name: b.name, input: b.input }] : [],
        );
        yield { type: 'tool_use', blocks };
        return;
      }
      stopReason = message.stop_reason === 'max_tokens' ? 'max_tokens' : 'end_turn';
    } catch (err) {
      if (signal.aborted) return; // Stop button: ChatService records the abort
      throw err;
    }
    yield { type: 'message_done', stopReason };
  }
}

function toSdkMessage({ role, content }: LlmMessage): Anthropic.MessageParam {
  return { role, content: content.map(toSdkBlock) };
}

function toSdkBlock(block: ContentBlock): Anthropic.ContentBlockParam {
  switch (block.type) {
    case 'text':
      return block;
    case 'tool_use':
      return block;
    case 'tool_result':
      return { type: 'tool_result', tool_use_id: block.toolUseId, content: block.content, is_error: block.isError };
  }
}

function toSdkTool({ name, description, inputSchema }: ToolDefinition): Anthropic.Tool {
  return { name, description, input_schema: { ...inputSchema, type: 'object' } };
}
