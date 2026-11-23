import { describe, expect, it } from 'vitest';
import type { Case } from '../dataset/case';
import { CodeEval } from './code-eval';

const testCase: Case = { id: 'c1', category: 'x', input: 'hi', criteria: [] };
const run = (reply: string) => new CodeEval().evaluate(testCase, reply);
const zeros = async (reply: string) => (await run(reply)).details.checks.filter((c) => c.score === 0).map((c) => c.name);

describe('CodeEval checks', () => {
  it('scores 10 for a short reply that ends with a question', async () => {
    expect(await zeros('"I went" is correct. Can you try another sentence?')).toEqual([]);
  });

  it('accepts markdown after the final question mark', async () => {
    expect(await zeros('Good try. **Ready for more?**')).toEqual([]);
  });

  it('scores 0 for long replies', async () => {
    expect(await zeros(`${'word '.repeat(130)}ok?`)).toEqual(['at most 120 words']);
  });

  it('scores 0 when the reply does not end with a question', async () => {
    expect(await zeros('Use the past simple.')).toEqual(['ends with a question']);
  });

  it('scores 0 for filler openers', async () => {
    expect(await zeros('Sure! Here is the rule. Got it?')).toEqual(['no filler opener']);
    expect(await zeros('Great question! Got it?')).toEqual(['no filler opener']);
  });
});

describe('CodeEval score', () => {
  it('is the mean of the checks', async () => {
    expect((await run('Use the past simple.')).score).toBeCloseTo(20 / 3);
  });
});
