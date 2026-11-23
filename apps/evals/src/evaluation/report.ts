import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CaseReport, EvalRun } from './evaluator';

export interface Report {
  createdAt: string;
  /** The system prompt that was evaluated, so before/after runs are self-explanatory. */
  prompt: string;
  /** 0–10, rounded. */
  average: number;
  /** Full detail per case (evaluations with their reasoning and checks, replies) for whoever wants to dig in. */
  cases: CaseReport[];
}

export function buildReport(prompt: string, { average, cases }: EvalRun, now = new Date()): Report {
  return { createdAt: now.toISOString(), prompt, average, cases };
}

/** Console output is scores only; details live in the saved JSON. */
export function formatReport(report: Report): string {
  const lines = report.cases.map((c) => `${c.id.padEnd(14)} ${String(c.score).padStart(2)}/10`);
  return [...lines, '', `${'AVERAGE'.padEnd(14)} ${String(report.average).padStart(2)}/10`].join('\n');
}

export function saveReport(report: Report, dir: string): string {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${report.createdAt.replace(/[:.]/g, '-')}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}
