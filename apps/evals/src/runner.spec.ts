import { describe, expect, it } from 'vitest';
import type { Case } from './dataset';
import { runCases } from './runner';

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
