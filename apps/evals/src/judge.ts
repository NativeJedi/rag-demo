import { z } from 'zod';
import type { LlmProvider } from '@chatbot/api/src/modules/llm/llm-provider';
import type { RunResult } from './runner';

const VerdictSchema = z.object({ score: z.number().int().min(0).max(10), reasoning: z.string() });
export type JudgeVerdict = z.infer<typeof VerdictSchema>;

/** One call per case: the criteria are the rubric, the answer is a 0–10 score plus reasoning. */
export function judge(llm: LlmProvider, prompt: string, { case: c, reply }: RunResult): Promise<JudgeVerdict> {
  const system = prompt
    .replace('{{input}}', c.input)
    .replace('{{reply}}', reply)
    .replace('{{criteria}}', c.criteria.map((text) => `- ${text}`).join('\n'));
  return llm.completeJson({ system, messages: [{ role: 'user', content: 'Score the reply.' }] }, VerdictSchema);
}
