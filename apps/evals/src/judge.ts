import { z } from 'zod';
import type { LlmProvider } from '@chatbot/api/src/modules/llm/llm-provider';
import type { Check } from './grade';
import type { RunResult } from './runner';

const VerdictsSchema = z.object({
  verdicts: z.array(z.object({ passed: z.boolean(), reason: z.string() })),
});

/** Asks the model to grade the reply against the case's criteria, one check per criterion. */
export async function judgeCriteria(llm: LlmProvider, prompt: string, { case: c, reply }: RunResult): Promise<Check[]> {
  const system = prompt
    .replace('{{input}}', c.input)
    .replace('{{reply}}', reply)
    .replace('{{criteria}}', c.criteria.map((text, i) => `${i + 1}. ${text}`).join('\n'));
  const { verdicts } = await llm.completeJson({ system, messages: [{ role: 'user', content: 'Grade the reply.' }] }, VerdictsSchema);
  if (verdicts.length !== c.criteria.length) {
    throw new Error(`Judge returned ${verdicts.length} verdicts for ${c.criteria.length} criteria (case ${c.id})`);
  }
  return c.criteria.map((name, i) => ({ name, passed: verdicts[i]!.passed, reason: verdicts[i]!.reason }));
}
