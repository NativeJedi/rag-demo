import { describe, expect, it } from 'vitest';
import type { EvalLlm } from '../llm/eval-llm';
import { DatasetGenerator, GeneratedSchema } from './dataset-generator';

const stub = (generated: unknown): EvalLlm => ({ completeJson: async (_request, schema) => schema.parse(generated) });

describe('DatasetGenerator', () => {
  it('adds ids and categories to the generated cases', async () => {
    const generator = new DatasetGenerator(
      stub({ cases: [{ input: 'I goed home', criteria: ['Corrects it'] }] }),
      '{{count}} {{category}}',
    );
    const cases = await generator.generate();
    expect(cases).toHaveLength(5);
    expect(cases[0]).toEqual({ id: 'mistakes-1', category: 'mistakes', input: 'I goed home', criteria: ['Corrects it'] });
  });

  it('GeneratedSchema rejects malformed output', () => {
    expect(GeneratedSchema.safeParse({ cases: [{ input: 'x' }] }).success).toBe(false);
  });
});
