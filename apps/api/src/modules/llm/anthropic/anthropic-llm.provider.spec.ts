import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../../config/config.module';
import type { LlmEvent, LlmMessage, LlmRequest } from '../llm-provider';
import { AnthropicLlmProvider } from './anthropic-llm.provider';

const sdk = vi.hoisted(() => ({ stream: vi.fn() }));
vi.mock('@anthropic-ai/sdk', () => ({ default: class { messages = { stream: sdk.stream }; } }));

function setup(sdkEvents: object[], stopReason: string = 'end_turn', content: object[] = []) {
  const stream = sdk.stream.mockImplementation(() =>
    Object.assign((async function* () { yield* sdkEvents; })(), {
      finalMessage: async () => ({ stop_reason: stopReason, content }),
    }),
  );
  const provider = new AnthropicLlmProvider({ ANTHROPIC_API_KEY: 'test-key', SYSTEM_PROMPT_FILE: 'system.md' } as AppConfig);
  const run = async (
    messages: LlmMessage[] = [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    extra: Omit<LlmRequest, 'messages'> = {},
  ) => {
    const events: LlmEvent[] = [];
    for await (const e of provider.stream({ messages, ...extra }, new AbortController().signal)) events.push(e);
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
      { role: 'user' as const, content: [{ type: 'text' as const, text: 'a' }] },
      { role: 'assistant' as const, content: [{ type: 'text' as const, text: 'b' }] },
      { role: 'user' as const, content: [{ type: 'text' as const, text: 'c' }] },
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

  it('sends tool definitions in the SDK shape', async () => {
    const { run, stream } = setup([]);
    await run(undefined, {
      tools: [{ name: 'find_words', description: 'd', inputSchema: { properties: { words: { type: 'array' } }, required: ['words'] } }],
    });
    expect(stream).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: [
          {
            name: 'find_words',
            description: 'd',
            input_schema: { type: 'object', properties: { words: { type: 'array' } }, required: ['words'] },
          },
        ],
      }),
      expect.anything(),
    );
  });

  it('omits tools when there are none', async () => {
    const { run, stream } = setup([]);
    await run(undefined, { tools: [] });
    expect(stream.mock.calls.at(-1)?.[0]).not.toHaveProperty('tools');
  });

  it('maps tool_use and tool_result blocks of the history', async () => {
    const { run, stream } = setup([]);
    await run([
      { role: 'user', content: [{ type: 'text', text: 'add lucid' }] },
      { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'find_words', input: { words: ['lucid'] } }] },
      { role: 'user', content: [{ type: 'tool_result', toolUseId: 't1', content: '{}', isError: true }] },
    ]);
    expect(stream.mock.calls.at(-1)?.[0].messages.slice(1)).toEqual([
      { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'find_words', input: { words: ['lucid'] } }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: '{}', is_error: true }] },
    ]);
  });

  it('ends a tool_use response with a tool_use event carrying all calls instead of message_done', async () => {
    const { run } = setup([delta('Checking')], 'tool_use', [
      { type: 'text', text: 'Checking' },
      { type: 'tool_use', id: 'a', name: 'get_current_datetime', input: {}, caller: { type: 'direct' } },
      { type: 'tool_use', id: 'b', name: 'find_words', input: { words: ['x'] }, caller: { type: 'direct' } },
    ]);
    expect(await run()).toEqual([
      { type: 'text_delta', text: 'Checking' },
      {
        type: 'tool_use',
        blocks: [
          { type: 'tool_use', id: 'a', name: 'get_current_datetime', input: {} },
          { type: 'tool_use', id: 'b', name: 'find_words', input: { words: ['x'] } },
        ],
      },
    ]);
  });
});
