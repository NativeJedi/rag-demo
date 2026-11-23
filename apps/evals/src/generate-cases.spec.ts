import { describe, expect, it } from 'vitest';
import { GeneratedSchema } from './dataset';
import type { EvalLlm } from './eval-llm';
import { generateCases } from './generate-cases';

const stub = (generated: unknown): EvalLlm => ({ completeJson: async (_request, schema) => schema.parse(generated) });

describe('generateCases', () => {
  it('adds ids and categories to the generated cases', async () => {
    const cases = await generateCases(stub({ cases: [{ input: 'I goed home', criteria: ['Corrects it'] }] }), '{{count}} {{category}}');
    expect(cases).toHaveLength(5);
    expect(cases[0]).toEqual({ id: 'mistakes-1', category: 'mistakes', input: 'I goed home', criteria: ['Corrects it'] });
  });

  it('GeneratedSchema rejects malformed output', () => {
    expect(GeneratedSchema.safeParse({ cases: [{ input: 'x' }] }).success).toBe(false);
  });
});
