import { describe, expect, it } from 'vitest';
import { score } from './grade';

describe('score', () => {
  it('is the share of passed checks', () => {
    expect(score([{ name: 'a', passed: true }, { name: 'b', passed: false }])).toBe(0.5);
  });
  it('is 0 without checks', () => {
    expect(score([])).toBe(0);
  });
});
