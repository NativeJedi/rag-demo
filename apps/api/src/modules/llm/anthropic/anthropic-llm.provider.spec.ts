import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { ChatEvent } from '@chatbot/shared';
import type { AppConfig } from '../../config/config.module';
import type { LlmMessage } from '../llm-provider';
import { AnthropicLlmProvider } from './anthropic-llm.provider';

const sdk = vi.hoisted(() => ({ stream: vi.fn() }));
vi.mock('@anthropic-ai/sdk', () => ({ default: class { messages = { stream: sdk.stream }; } }));

function setup(sdkEvents: object[], stopReason: string = 'end_turn') {
  const stream = sdk.stream.mockImplementation(() =>
    Object.assign((async function* () { yield* sdkEvents; })(), {
      finalMessage: async () => ({ stop_reason: stopReason }),
    }),
  );
  const provider = new AnthropicLlmProvider({ ANTHROPIC_API_KEY: 'test-key' } as AppConfig);
  const run = async (messages: LlmMessage[] = [{ role: 'user', content: 'hi' }]) => {
    const events: ChatEvent[] = [];
    for await (const e of provider.stream({ messages }, new AbortController().signal)) events.push(e);
    return events;
  };
  return { stream, run };
}

const delta = (text: string) => ({ type: 'content_block_delta', delta: { type: 'text_delta', text } });

describe('AnthropicLlmProvider', () => {
  it('maps text deltas and ends with message_done', async () => {
    const { run } = setup([delta('Hel'), delta('lo')]);
    expect(await run()).toEqual([
      { type: 'text_delta', text: 'Hel' },
      { type: 'text_delta', text: 'lo' },
      { type: 'message_done', stopReason: 'end_turn' },
    ]);
  });

  it('maps max_tokens', async () => {
    const { run } = setup([delta('x')], 'max_tokens');
    expect((await run()).at(-1)).toEqual({ type: 'message_done', stopReason: 'max_tokens' });
  });

  it('sends the whole history with the configured model', async () => {
    const { run, stream } = setup([]);
    const messages = [
      { role: 'user' as const, content: 'a' },
      { role: 'assistant' as const, content: 'b' },
      { role: 'user' as const, content: 'c' },
    ];
    await run(messages);
    expect(stream).toHaveBeenCalledWith(expect.objectContaining({ model: 'claude-haiku-5-5', messages }), expect.anything());
  });

  it('sends the system prompt from prompts/system.md', async () => {
    const { run, stream } = setup([]);
    await run();
    const prompt = readFileSync(join(__dirname, '..', '..', '..', '..', 'prompts', 'system.md'), 'utf8').trim();
    expect(prompt).not.toBe('');
    expect(stream).toHaveBeenCalledWith(expect.objectContaining({ system: prompt }), expect.anything());
  });
});
