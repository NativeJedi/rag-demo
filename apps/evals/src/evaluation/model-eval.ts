import { z } from 'zod';
import type { Case } from '../dataset/case';
import type { EvalLlm } from '../llm/eval-llm';
import { fillTemplate } from '../utils/prompt-template';
import type { CaseEval, Evaluation } from './case-eval';

const VerdictSchema = z.object({ score: z.number().int().min(0).max(10), reasoning: z.string() });

/** An opinion of a judge model: one call per case, the criteria are the rubric, the answer is a 0–10 score plus reasoning. */
export class ModelEval implements CaseEval {
  constructor(
    private readonly llm: EvalLlm,
    private readonly prompt: string,
  ) {}

  async evaluate({ input, criteria }: Case, reply: string): Promise<Evaluation> {
    const system = fillTemplate(this.prompt, {
      input,
      reply,
      criteria: criteria.map((text) => `- ${text}`).join('\n'),
    });
    const { score, reasoning } = await this.llm.completeJson({ system, user: 'Score the reply.' }, VerdictSchema);
    return { name: 'model', score, details: { reasoning } };
  }
}
