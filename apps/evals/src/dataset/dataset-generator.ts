import { z } from 'zod';
import type { EvalLlm } from '../llm/eval-llm';
import { fillTemplate } from '../utils/prompt-template';
import type { Case } from './case';
import { CASES_PER_CATEGORY, CATEGORIES } from './case-categories';

/** What the model returns for one category (ids and category are added in code). */
export const GeneratedSchema = z.object({
  cases: z.array(z.object({ input: z.string(), criteria: z.array(z.string()) })),
});
type Generated = z.infer<typeof GeneratedSchema>;

/** Asks the model for test cases, one request per category. */
export class DatasetGenerator {
  constructor(
    private readonly llm: EvalLlm,
    private readonly promptTemplate: string,
  ) {}

  async generate(): Promise<Case[]> {
    const cases: Case[] = [];
    for (const [category, description] of Object.entries(CATEGORIES)) {
      cases.push(...(await this.generateForCategory(category, description)));
    }
    return cases;
  }

  private async generateForCategory(category: string, description: string): Promise<Case[]> {
    const generated = await this.askModel(description);
    return this.toCases(category, generated);
  }

  private askModel(categoryDescription: string): Promise<Generated> {
    const system = fillTemplate(this.promptTemplate, {
      count: String(CASES_PER_CATEGORY),
      category: categoryDescription,
    });
    return this.llm.completeJson({ system, user: 'Write the test cases.' }, GeneratedSchema);
  }

  private toCases(category: string, { cases }: Generated): Case[] {
    return cases.map((c, i) => ({ id: `${category}-${i + 1}`, category, ...c }));
  }
}
