import type { Case } from './dataset';

export interface RunResult {
  case: Case;
  reply: string;
  /** Set when the tutor failed to answer; graders treat the case as failed. */
  error?: string;
}

/** Runs the cases one by one (keeps rate limits and logs simple). */
export async function runCases(cases: Case[], reply: (input: string) => Promise<string>): Promise<RunResult[]> {
  const results: RunResult[] = [];
  for (const c of cases) {
    try {
      results.push({ case: c, reply: await reply(c.input) });
    } catch (err) {
      results.push({ case: c, reply: '', error: err instanceof Error ? err.message : String(err) });
    }
  }
  return results;
}
