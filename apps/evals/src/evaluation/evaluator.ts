import type { LlmProvider } from '@chatbot/api/src/modules/llm/llm-provider';
import type { Case } from '../dataset/case';
import type { EvalLlm } from '../llm/eval-llm';
import type { CaseEval, Evaluation } from './case-eval';
import { CodeEval } from './code-eval';
import { ModelEval } from './model-eval';

export interface CaseReport {
  id: string;
  category: string;
  /** 0–10, the rounded mean of the evaluations' scores. */
  score: number;
  evaluations: Evaluation[];
  reply: string;
}

export interface EvalRun {
  /** 0–10, the rounded mean of the case scores. */
  average: number;
  cases: CaseReport[];
}

const mean = (values: number[]): number => (values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length);

/** Sends each case to the chat and scores its reply with every evaluator in the list. */
export class Evaluator {
  private readonly evaluators: CaseEval[] = [];

  constructor(
    private readonly chat: LlmProvider,
    judgeLlm: EvalLlm,
    judgePrompt: string,
  ) {
    this.evaluators.push(new ModelEval(judgeLlm, judgePrompt), new CodeEval());
  }

  /** Runs the cases one by one. Any provider error aborts the whole eval: a score over partial data would be misleading. */
  async evaluate(cases: Case[]): Promise<EvalRun> {
    const reports: CaseReport[] = [];
    for (const c of cases) reports.push(await this.evaluateCase(c));
    return { average: Math.round(mean(reports.map((r) => r.score))), cases: reports };
  }

  private async evaluateCase(c: Case): Promise<CaseReport> {
    const reply = await this.replyTo(c.input);
    const evaluations: Evaluation[] = [];
    for (const evaluator of this.evaluators) evaluations.push(await evaluator.evaluate(c, reply));
    return {
      id: c.id,
      category: c.category,
      score: Math.round(mean(evaluations.map((e) => e.score))),
      evaluations,
      reply,
    };
  }

  /** The chat's whole reply to one user message, collected from its stream (the provider owns the system prompt). */
  private async replyTo(input: string): Promise<string> {
    const request = { messages: [{ role: 'user' as const, content: input }] };
    let reply = '';
    for await (const event of this.chat.stream(request, new AbortController().signal)) {
      if (event.type === 'text_delta') reply += event.text;
      else if (event.type === 'error') throw new Error(event.message);
    }
    return reply;
  }
}
