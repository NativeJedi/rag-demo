import { describe, expect, it } from 'vitest';
import type { ChatEvent } from '@chatbot/shared';
import { MockLlmProvider } from './mock-llm.provider';

async function collect(input: string, signal = new AbortController().signal): Promise<ChatEvent[]> {
  const events: ChatEvent[] = [];
  for await (const event of new MockLlmProvider(0).stream({ messages: [{ role: 'user', content: input }] }, signal)) {
    events.push(event);
  }
  return events;
}

const textOf = (events: ChatEvent[]) => events.flatMap((e) => (e.type === 'text_delta' ? [e.text] : [])).join('');

describe('MockLlmProvider', () => {
  it('streams the reply as text deltas and ends with message_done', async () => {
    const events = await collect('hello');
    expect(events.length).toBeGreaterThan(1);
    expect(textOf(events)).toContain('hello');
    expect(events.at(-1)).toEqual({ type: 'message_done', stopReason: 'end_turn' });
  });

  it('ends with an error event after partial text for /error', async () => {
    const events = await collect('/error');
    expect(textOf(events)).not.toBe('');
    expect(events.at(-1)).toMatchObject({ type: 'error', code: 'provider_error' });
  });

  it('stops silently when the signal is already aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    expect(await collect('hello', ac.signal)).toEqual([]);
  });
});
