import { describe, expect, it } from 'vitest';
import type { LlmProvider } from '@chatbot/api/src/modules/llm/llm-provider';
import { generateCases } from './generate-cases';

function stub(reply: string): LlmProvider {
  return { complete: async () => reply, stream: async function* () {} };
}

describe('generateCases', () => {
  it('parses JSON (even with surrounding text) and adds ids and categories', async () => {
    const reply = 'Here you go: {"cases":[{"input":"I goed home","criteria":["Corrects it"]}]} done';
    const cases = await generateCases(stub(reply), '{{count}} {{category}}');
    expect(cases).toHaveLength(5);
    expect(cases[0]).toEqual({ id: 'mistakes-1', category: 'mistakes', input: 'I goed home', criteria: ['Corrects it'] });
  });

  it('rejects malformed output', async () => {
    await expect(generateCases(stub('{"cases":[{"input":""}]}'), '')).rejects.toThrow();
  });
});
