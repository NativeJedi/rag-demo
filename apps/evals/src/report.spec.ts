import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildReport, formatReport, saveReport } from './report';

const graded = [
  { id: 'a-1', category: 'a', checks: [{ name: 'x', passed: true }, { name: 'y', passed: false, reason: 'too long' }] },
  { id: 'b-1', category: 'b', checks: [{ name: 'x', passed: true }] },
];
const report = buildReport('prompt text', graded, new Date('2026-11-18T10:00:00.000Z'));

describe('report', () => {
  it('computes case scores and the average', () => {
    expect(report.cases.map((c) => c.score)).toEqual([0.5, 1]);
    expect(report.average).toBe(0.75);
  });

  it('prints scores, failed checks and the average', () => {
    expect(formatReport(report)).toBe(
      [`${'a-1'.padEnd(14)} 0.50`, '    FAIL y (too long)', `${'b-1'.padEnd(14)} 1.00`, '', `${'AVERAGE'.padEnd(14)} 0.75`].join('\n'),
    );
  });

  it('saves JSON named after the timestamp', () => {
    const file = saveReport(report, join(mkdtempSync(join(tmpdir(), 'evals-')), 'results'));
    expect(file.endsWith('2026-11-18T10-00-00-000Z.json')).toBe(true);
    expect(JSON.parse(readFileSync(file, 'utf8')).average).toBe(0.75);
  });
});
