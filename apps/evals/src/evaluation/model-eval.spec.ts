import { describe, expect, it } from 'vitest';
import type { Case } from '../dataset/case';
import type { EvalLlm } from '../llm/eval-llm';
import { ModelEval } from './model-eval';

const testCase: Case = { id: 'c1', category: 'x', input: 'I goed home', criteria: ['Corrects it', 'Ends with a question'] };
const reply = 'I went home. OK?';

const stub = (verdict: unknown, seen: string[] = []): EvalLlm => ({
  completeJson: async (request, schema) => {
    seen.push(request.system);
    return schema.parse(verdict);
  },
});

describe('ModelEval', () => {
  it('puts input, reply and criteria into the prompt and returns the verdict', async () => {
    const seen: string[] = [];
    const evaluation = await new ModelEval(stub({ score: 8, reasoning: 'ok' }, seen), '{{input}} | {{reply}} | {{criteria}}').evaluate(testCase, reply);
    expect(evaluation).toEqual({ name: 'model', score: 8, details: { reasoning: 'ok' } });
    expect(seen[0]).toBe('I goed home | I went home. OK? | - Corrects it\n- Ends with a question');
  });

  it('rejects scores outside 0–10', async () => {
    await expect(new ModelEval(stub({ score: 11, reasoning: 'x' }), '').evaluate(testCase, reply)).rejects.toThrow();
  });
});
