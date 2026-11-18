import { describe, expect, it } from 'vitest';
import { codeChecks, codeScore } from './code-graders';

const zeros = (reply: string) => codeChecks(reply).filter((c) => c.score === 0).map((c) => c.name);

describe('codeChecks', () => {
  it('scores 10 for a short reply that ends with a question', () => {
    expect(zeros('"I went" is correct. Can you try another sentence?')).toEqual([]);
  });

  it('accepts markdown after the final question mark', () => {
    expect(zeros('Good try. **Ready for more?**')).toEqual([]);
  });

  it('scores 0 for long replies', () => {
    expect(zeros(`${'word '.repeat(130)}ok?`)).toEqual(['at most 120 words']);
  });

  it('scores 0 when the reply does not end with a question', () => {
    expect(zeros('Use the past simple.')).toEqual(['ends with a question']);
  });

  it('scores 0 for filler openers', () => {
    expect(zeros('Sure! Here is the rule. Got it?')).toEqual(['no filler opener']);
    expect(zeros('Great question! Got it?')).toEqual(['no filler opener']);
  });
});

describe('codeScore', () => {
  it('is the mean of the checks', () => {
    expect(codeScore(codeChecks('Use the past simple.'))).toBeCloseTo(20 / 3);
  });
});
