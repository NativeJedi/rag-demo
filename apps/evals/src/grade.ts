import { type CodeCheck, codeChecks, codeScore } from './code-graders';
import type { EvalLlm } from './eval-llm';
import { type JudgeVerdict, judge } from './judge';
import type { RunResult } from './runner';

export interface CaseReport {
  id: string;
  category: string;
  /** 0–10, the rounded mean of the judge score and the code score. */
  score: number;
  judge: JudgeVerdict;
  code: { score: number; checks: CodeCheck[] };
}

export async function gradeCase(llm: EvalLlm, judgePrompt: string, result: RunResult): Promise<CaseReport> {
  const checks = codeChecks(result.reply);
  const verdict = await judge(llm, judgePrompt, result);
  const code = codeScore(checks);
  return {
    id: result.case.id,
    category: result.case.category,
    score: Math.round((verdict.score + code) / 2),
    judge: verdict,
    code: { score: code, checks },
  };
}
