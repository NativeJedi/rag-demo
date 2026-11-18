import { describe, expect, it } from 'vitest';
import type { LlmProvider } from '@chatbot/api/src/modules/llm/llm-provider';
import { judgeCriteria } from './judge';
import type { RunResult } from './runner';

const result: RunResult = {
  case: { id: 'c1', category: 'x', input: 'I goed home', criteria: ['Corrects it', 'Ends with a question'] },
  reply: 'I went home. OK?',
};

function stub(verdicts: unknown[], seen: string[] = []): LlmProvider {
  return {
    complete: async () => '',
    completeJson: async (request, schema) => {
      seen.push(request.system ?? '');
      return schema.parse({ verdicts });
    },
    stream: async function* () {},
  };
}

describe('judgeCriteria', () => {
  it('returns one check per criterion and puts input, reply and criteria into the prompt', async () => {
    const seen: string[] = [];
    const checks = await judgeCriteria(
      stub([{ passed: true, reason: 'yes' }, { passed: false, reason: 'no' }], seen),
      '{{input}} | {{reply}} | {{criteria}}',
      result,
    );
    expect(checks).toEqual([
      { name: 'Corrects it', passed: true, reason: 'yes' },
      { name: 'Ends with a question', passed: false, reason: 'no' },
    ]);
    expect(seen[0]).toBe('I goed home | I went home. OK? | 1. Corrects it\n2. Ends with a question');
  });

  it('throws when the verdict count does not match', async () => {
    await expect(judgeCriteria(stub([{ passed: true, reason: 'yes' }]), '', result)).rejects.toThrow('1 verdicts for 2 criteria');
  });
});
