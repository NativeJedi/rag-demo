import { describe, expect, it } from 'vitest';
import type { LlmProvider } from '@chatbot/api/src/modules/llm/llm-provider';
import { judgeCriteria } from './judge';
import type { RunResult } from './runner';

const result: RunResult = {
  case: { id: 'c1', category: 'x', input: 'I goed home', criteria: ['Corrects it', 'Ends with a question'] },
  reply: 'I went home. OK?',
};

describe('judgeCriteria', () => {
  it('asks once per criterion and returns one check each, in order', async () => {
    const prompts: string[] = [];
    const llm: LlmProvider = {
      complete: async () => '',
      completeJson: async (request, schema) => {
        prompts.push(request.system ?? '');
        return schema.parse({ passed: prompts.length === 1, reason: `r${prompts.length}` });
      },
      stream: async function* () {},
    };
    const checks = await judgeCriteria(llm, '{{input}} | {{reply}} | {{criterion}}', result);
    expect(prompts).toEqual(['I goed home | I went home. OK? | Corrects it', 'I goed home | I went home. OK? | Ends with a question']);
    expect(checks).toEqual([
      { name: 'Corrects it', passed: true, reason: 'r1' },
      { name: 'Ends with a question', passed: false, reason: 'r2' },
    ]);
  });
});
