import { describe, expect, it } from 'vitest';
import { fillTemplate } from './prompt-template';

describe('fillTemplate', () => {
  it('replaces every occurrence of each placeholder', () => {
    expect(fillTemplate('{{a}} and {{b}} and {{a}}', { a: '1', b: '2' })).toBe('1 and 2 and 1');
  });

  it('inserts values literally', () => {
    expect(fillTemplate('{{a}}', { a: 'costs $& and $1' })).toBe('costs $& and $1');
  });
});
