import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.schema';

describe('loadConfig', () => {
  it('applies defaults with an empty env', () => {
    expect(loadConfig({})).toEqual({ PORT: 3000, WEB_ORIGIN: 'http://localhost:5173' });
  });

  it('treats empty strings as unset', () => {
    expect(loadConfig({ PORT: '' }).PORT).toBe(3000);
  });

  it('fails fast on an invalid value', () => {
    expect(() => loadConfig({ PORT: 'nope' })).toThrow(/PORT/);
  });
});
