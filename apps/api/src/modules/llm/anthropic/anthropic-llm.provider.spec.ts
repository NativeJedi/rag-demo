import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import type { ChatEvent } from '@chatbot/shared';
import type { LlmMessage } from '../llm-provider';
import { AnthropicLlmProvider } from './anthropic-llm.provider';

function setup(sdkEvents: object[]) {
  const stream = vi.fn(() => (async function* () { yield* sdkEvents; })());
  const provider = new AnthropicLlmProvider({ messages: { stream } } as unknown as Pick<Anthropic, 'messages'>, 'test-model');
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
    const { run } = setup([delta('Hel'), delta('lo'), { type: 'message_delta', delta: { stop_reason: 'end_turn' } }]);
    expect(await run()).toEqual([
      { type: 'text_delta', text: 'Hel' },
      { type: 'text_delta', text: 'lo' },
      { type: 'message_done', stopReason: 'end_turn' },
    ]);
  });

  it('maps max_tokens', async () => {
    const { run } = setup([delta('x'), { type: 'message_delta', delta: { stop_reason: 'max_tokens' } }]);
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
    expect(stream).toHaveBeenCalledWith(expect.objectContaining({ model: 'test-model', messages }), expect.anything());
  });
});
