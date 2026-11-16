import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.schema';

describe('loadConfig', () => {
  it('applies defaults with an empty env', () => {
    expect(loadConfig({ ANTHROPIC_API_KEY: 'k' })).toEqual({
      PORT: 3000,
      WEB_ORIGIN: 'http://localhost:5173',
      ANTHROPIC_API_KEY: 'k',
    });
  });

  it('treats empty strings as unset', () => {
    expect(loadConfig({ PORT: '', ANTHROPIC_API_KEY: 'k' }).PORT).toBe(3000);
  });

  it('fails fast on an invalid value', () => {
    expect(() => loadConfig({ PORT: 'nope', ANTHROPIC_API_KEY: 'k' })).toThrow(/PORT/);
  });

  it('fails fast without an API key', () => {
    expect(() => loadConfig({})).toThrow(/ANTHROPIC_API_KEY/);
  });
});
