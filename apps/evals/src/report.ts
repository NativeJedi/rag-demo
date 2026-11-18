import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Check, score } from './grade';

export interface CaseReport {
  id: string;
  category: string;
  score: number;
  checks: Check[];
}

export interface Report {
  createdAt: string;
  /** The system prompt that was evaluated, so before/after runs are self-explanatory. */
  prompt: string;
  average: number;
  cases: CaseReport[];
}

export function buildReport(prompt: string, graded: Omit<CaseReport, 'score'>[], now = new Date()): Report {
  const cases = graded.map((c) => ({ ...c, score: score(c.checks) }));
  const average = cases.length === 0 ? 0 : cases.reduce((sum, c) => sum + c.score, 0) / cases.length;
  return { createdAt: now.toISOString(), prompt, average, cases };
}

/** Table of scores, the failed checks under each case, and the average. */
export function formatReport(report: Report): string {
  const lines = report.cases.flatMap((c) => [
    `${c.id.padEnd(14)} ${c.score.toFixed(2)}`,
    ...c.checks.filter((k) => !k.passed).map((k) => `    FAIL ${k.name}${k.reason ? ` (${k.reason})` : ''}`),
  ]);
  return [...lines, '', `AVERAGE        ${report.average.toFixed(2)}`].join('\n');
}

export function saveReport(report: Report, dir: string): string {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${report.createdAt.replace(/[:.]/g, '-')}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}
