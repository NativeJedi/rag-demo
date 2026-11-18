import { describe, expect, it } from 'vitest';
import { codeChecks } from './code-graders';

const failed = (reply: string) => codeChecks(reply).filter((c) => !c.passed).map((c) => c.name);

describe('codeChecks', () => {
  it('passes a short reply that ends with a question', () => {
    expect(failed('"I went" is correct. Can you try another sentence?')).toEqual([]);
  });

  it('accepts markdown after the final question mark', () => {
    expect(failed('Good try. **Ready for more?**')).toEqual([]);
  });

  it('fails long replies', () => {
    expect(failed(`${'word '.repeat(130)}ok?`)).toEqual(['at most 120 words']);
  });

  it('fails replies that do not end with a question', () => {
    expect(failed('Use the past simple.')).toEqual(['ends with a question']);
  });

  it('fails filler openers', () => {
    expect(failed('Sure! Here is the rule. Got it?')).toEqual(['no filler opener']);
    expect(failed('Great question! Got it?')).toEqual(['no filler opener']);
  });
});
