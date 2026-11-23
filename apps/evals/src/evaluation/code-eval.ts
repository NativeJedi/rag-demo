import type { Case } from '../dataset/case';
import type { CaseEval, Evaluation } from './case-eval';

const MAX_WORDS = 120;
const FILLER_OPENER = /^\W*(sure|certainly|of course|absolutely|great question|good question)\b/i;

export interface CodeCheck {
  name: string;
  /** Measurements are binary: 0 or 10. */
  score: 0 | 10;
}

const ten = (ok: boolean): 0 | 10 => (ok ? 10 : 0);

/** Deterministic checks of the tutor rules that need no judge; the score is their mean. */
export class CodeEval implements CaseEval {
  async evaluate(_testCase: Case, reply: string): Promise<Evaluation<{ checks: CodeCheck[] }>> {
    const checks = this.checks(reply);
    const score = checks.reduce((sum, c) => sum + c.score, 0) / checks.length;
    return { name: 'code', score, details: { checks } };
  }

  private checks(reply: string): CodeCheck[] {
    const text = reply.trim();
    const words = text.split(/\s+/).filter(Boolean).length;
    return [
      { name: `at most ${MAX_WORDS} words`, score: ten(words <= MAX_WORDS) },
      // trailing markdown (e.g. "**Ready?**") is fine
      { name: 'ends with a question', score: ten(/\?[\s*_"')]*$/.test(text)) },
      { name: 'no filler opener', score: ten(!FILLER_OPENER.test(text)) },
    ];
  }
}
