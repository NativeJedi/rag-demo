import { describe, expect, it } from 'vitest';
import type { EvalLlm } from './eval-llm';
import { gradeCase } from './grade';

const llm = (score: number): EvalLlm => ({
  completeJson: async (_request, schema) => schema.parse({ score, reasoning: 'r' }),
});

const run = (reply: string) => ({ case: { id: 'a-1', category: 'a', input: 'hi', criteria: ['c'] }, reply });

describe('gradeCase', () => {
  it('rounds the mean of the judge score and the code score', async () => {
    // code checks: all pass (10); judge: 7 -> mean 8.5 -> 9
    const report = await gradeCase(llm(7), '', run('Nice. Ready for more?'));
    expect(report).toMatchObject({ id: 'a-1', score: 9, judge: { score: 7 }, code: { score: 10 } });
  });

  it('pulls the score down when code checks fail', async () => {
    // code: only the length check passes -> 10/3; (10 + 3.33) / 2 = 6.67 -> 7
    const report = await gradeCase(llm(10), '', run('Sure! Use the past simple.'));
    expect(report.code.score).toBeCloseTo(10 / 3);
    expect(report.score).toBe(7);
  });
});
