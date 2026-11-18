import { describe, expect, it } from 'vitest';
import type { Case } from './dataset';
import { runCases } from './runner';

const cases: Case[] = [
  { id: 'a', category: 'x', input: 'ok', criteria: ['c'] },
  { id: 'b', category: 'x', input: 'boom', criteria: ['c'] },
];

describe('runCases', () => {
  it('collects replies and keeps going after an error', async () => {
    const results = await runCases(cases, async (input) => {
      if (input === 'boom') throw new Error('provider down');
      return `echo ${input}`;
    });
    expect(results.map((r) => [r.case.id, r.reply, r.error])).toEqual([
      ['a', 'echo ok', undefined],
      ['b', '', 'provider down'],
    ]);
  });
});
