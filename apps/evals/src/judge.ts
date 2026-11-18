import { z } from 'zod';
import type { LlmProvider } from '@chatbot/api/src/modules/llm/llm-provider';
import type { Check } from './grade';
import type { RunResult } from './runner';

const VerdictSchema = z.object({ passed: z.boolean(), reason: z.string() });

/** One judge call per criterion, so there is exactly one verdict for each. */
export async function judgeCriteria(llm: LlmProvider, prompt: string, { case: c, reply }: RunResult): Promise<Check[]> {
  return Promise.all(
    c.criteria.map(async (criterion): Promise<Check> => {
      const system = prompt.replace('{{input}}', c.input).replace('{{reply}}', reply).replace('{{criterion}}', criterion);
      const verdict = await llm.completeJson({ system, messages: [{ role: 'user', content: 'Grade the reply.' }] }, VerdictSchema);
      return { name: criterion, ...verdict };
    }),
  );
}
