import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildReport, formatReport, saveReport } from './report';

const caseReport = (id: string, score: number) => ({
  id,
  category: 'x',
  score,
  reply: 'text',
  judge: { score, reasoning: 'because' },
  code: { score: 10, checks: [{ name: 'c', score: 10 as const }] },
});
const report = buildReport('prompt text', [caseReport('a-1', 6), caseReport('b-1', 9)], new Date('2026-11-18T10:00:00.000Z'));

describe('report', () => {
  it('rounds the average of case scores', () => {
    expect(report.average).toBe(8); // 7.5 -> 8
  });

  it('prints scores only', () => {
    expect(formatReport(report)).toBe(
      [`${'a-1'.padEnd(14)}  6/10`, `${'b-1'.padEnd(14)}  9/10`, '', `${'AVERAGE'.padEnd(14)}  8/10`].join('\n'),
    );
  });

  it('saves the full detail as JSON named after the timestamp', () => {
    const file = saveReport(report, join(mkdtempSync(join(tmpdir(), 'evals-')), 'results'));
    expect(file.endsWith('2026-11-18T10-00-00-000Z.json')).toBe(true);
    expect(JSON.parse(readFileSync(file, 'utf8')).cases[0].judge.reasoning).toBe('because');
  });
});
