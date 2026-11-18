export interface Check {
  name: string;
  passed: boolean;
  /** Why it failed (or the judge's note). */
  reason?: string;
}

/** Case score = share of passed checks (code checks + judge criteria). */
export function score(checks: Check[]): number {
  return checks.length === 0 ? 0 : checks.filter((c) => c.passed).length / checks.length;
}
