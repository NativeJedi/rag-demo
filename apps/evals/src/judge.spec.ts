import { describe, expect, it } from 'vitest';
import type { EvalLlm } from './eval-llm';
import { judge } from './judge';
import type { RunResult } from './runner';

const result: RunResult = {
  case: { id: 'c1', category: 'x', input: 'I goed home', criteria: ['Corrects it', 'Ends with a question'] },
  reply: 'I went home. OK?',
};

const stub = (verdict: unknown, seen: string[] = []): EvalLlm => ({
  completeJson: async (request, schema) => {
    seen.push(request.system);
    return schema.parse(verdict);
  },
});

describe('judge', () => {
  it('puts input, reply and criteria into the prompt and returns the verdict', async () => {
    const seen: string[] = [];
    const verdict = await judge(stub({ score: 8, reasoning: 'ok' }, seen), '{{input}} | {{reply}} | {{criteria}}', result);
    expect(verdict).toEqual({ score: 8, reasoning: 'ok' });
    expect(seen[0]).toBe('I goed home | I went home. OK? | - Corrects it\n- Ends with a question');
  });

  it('rejects scores outside 0–10', async () => {
    await expect(judge(stub({ score: 11, reasoning: 'x' }), '', result)).rejects.toThrow();
  });
});
