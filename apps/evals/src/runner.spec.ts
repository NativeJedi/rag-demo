import { describe, expect, it } from 'vitest';
import type { ChatEvent } from '@chatbot/shared';
import type { Case } from './dataset';
import { collectReply, runCases } from './runner';

const cases: Case[] = [
  { id: 'a', category: 'x', input: 'ok', criteria: ['c'] },
  { id: 'b', category: 'x', input: 'boom', criteria: ['c'] },
];

describe('runCases', () => {
  it('pairs each case with its reply', async () => {
    const results = await runCases([cases[0]!], async (input) => `echo ${input}`);
    expect(results).toEqual([{ case: cases[0], reply: 'echo ok' }]);
  });

  it('aborts on the first provider error', async () => {
    const run = runCases(cases, async (input) => {
      if (input === 'boom') throw new Error('provider down');
      return 'fine';
    });
    await expect(run).rejects.toThrow('provider down');
  });
});

describe('collectReply', () => {
  const llm = (events: ChatEvent[]) => ({
    stream: async function* () {
      yield* events;
    },
  });

  it('joins the text deltas', async () => {
    const events: ChatEvent[] = [
      { type: 'text_delta', text: 'Hel' },
      { type: 'text_delta', text: 'lo' },
      { type: 'message_done', stopReason: 'end_turn' },
    ];
    expect(await collectReply(llm(events), 'hi')).toBe('Hello');
  });

  it('throws on an error event', async () => {
    const events: ChatEvent[] = [{ type: 'error', code: 'provider_error', message: 'down' }];
    await expect(collectReply(llm(events), 'hi')).rejects.toThrow('down');
  });
});
