import type { Case } from '../dataset/case';

export interface Evaluation<D = unknown> {
  /** Which evaluator produced it, e.g. "model" or "code". */
  name: string;
  /** 0–10. */
  score: number;
  /** Evaluator-specific detail (reasoning, checks) for the saved JSON. */
  details: D;
}

/** One way of scoring a reply to a case. The Evaluator runs a list of these. */
export interface CaseEval {
  evaluate(testCase: Case, reply: string): Promise<Evaluation>;
}
