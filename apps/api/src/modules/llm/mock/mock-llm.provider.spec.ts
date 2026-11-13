import { describe, expect, it } from 'vitest';
import { ChatEventSchema, type ChatEvent } from '@chatbot/shared';
import type { LlmRequest } from '../llm-provider';
import { MockLlmProvider } from './mock-llm.provider';

const req = (content: string): LlmRequest => ({
  messages: [{ role: 'user', blocks: [{ type: 'text', text: content }] }],
  temperature: 1,
  maxTokens: 100,
  model: 'default',
  modelId: 'test-model',
});

async function collect(content: string, signal = new AbortController().signal): Promise<ChatEvent[]> {
  const out: ChatEvent[] = [];
  for await (const e of new MockLlmProvider(0).stream(req(content), signal)) out.push(e);
  return out;
}

const types = (events: ChatEvent[]) => [...new Set(events.map((e) => e.type))];
const text = (events: ChatEvent[]) =>
  events.flatMap((e) => (e.type === 'text_delta' ? [e.text] : [])).join('');

describe('MockLlmProvider', () => {
  it('echoes the input by default and ends with usage + message_done', async () => {
    const events = await collect('hello there');
    expect(events[0]).toMatchObject({ type: 'message_start', model: 'test-model' });
    expect(text(events)).toContain('hello there');
    expect(events.at(-1)).toEqual({ type: 'message_done', stopReason: 'end_turn' });
    expect(events.at(-2)?.type).toBe('usage');
  });

  it('emits only schema-valid events in every scenario', async () => {
    for (const s of ['', '/mock thinking', '/mock tools', '/mock citations', '/mock long', '/mock error']) {
      for (const e of await collect(s)) expect(ChatEventSchema.safeParse(e).success).toBe(true);
    }
  });

  it('thinking: thinking deltas precede text', async () => {
    const events = await collect('/mock thinking');
    expect(types(events)).toEqual(['message_start', 'thinking_delta', 'text_delta', 'usage', 'message_done']);
    expect(events.findIndex((e) => e.type === 'thinking_delta')).toBeLessThan(
      events.findIndex((e) => e.type === 'text_delta'),
    );
  });

  it('tools: start → delta → call → result, including an error result', async () => {
    const events = await collect('/mock tools');
    const order = events.map((e) => e.type).filter((t) => t.startsWith('tool_'));
    expect(order.slice(0, 5)).toEqual(['tool_call_start', 'tool_call_delta', 'tool_call_delta', 'tool_call', 'tool_result']);
    const results = events.filter((e) => e.type === 'tool_result');
    expect(results.map((r) => r.isError)).toEqual([false, true]);
    const deltas = events.flatMap((e) => (e.type === 'tool_call_delta' && e.toolUseId === 'toolu_mock_1' ? [e.partialJson] : []));
    expect(JSON.parse(deltas.join(''))).toEqual({ city: 'Berlin', unit: 'celsius' });
  });

  it('citations: citation events follow the text', async () => {
    const events = await collect('/mock citations');
    const firstCitation = events.findIndex((e) => e.type === 'citation');
    expect(firstCitation).toBeGreaterThan(events.findLastIndex((e) => e.type === 'text_delta') - 1);
    expect(events.filter((e) => e.type === 'citation')).toHaveLength(2);
  });

  it('long: produces roughly 2,000+ words', async () => {
    const words = text(await collect('/mock long')).split(/\s+/).length;
    expect(words).toBeGreaterThanOrEqual(2000);
  });

  it('error: emits error mid-stream and no message_done', async () => {
    const events = await collect('/mock error');
    expect(events.at(-1)).toMatchObject({ type: 'error', retryable: true });
    expect(types(events)).not.toContain('message_done');
    expect(types(events)).toContain('text_delta');
  });

  it('falls back to echo for unknown scenarios', async () => {
    expect(text(await collect('/mock nope'))).toContain('Mock reply');
  });

  it('stops yielding after abort', async () => {
    const ac = new AbortController();
    const out: ChatEvent[] = [];
    for await (const e of new MockLlmProvider(0).stream(req('/mock long'), ac.signal)) {
      out.push(e);
      if (out.length === 5) ac.abort();
    }
    expect(out).toHaveLength(5);
  });

  it('complete() returns a result', async () => {
    const r = await new MockLlmProvider(0).complete(req('hi'));
    expect(r.text).toContain('hi');
  });
});
