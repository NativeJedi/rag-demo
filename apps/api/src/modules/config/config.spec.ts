import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.schema';

describe('loadConfig', () => {
  it('applies defaults with an empty env', () => {
    const c = loadConfig({});
    expect(c).toMatchObject({ PORT: 3000, LLM_PROVIDER: 'mock', MAX_AGENT_STEPS: 8 });
  });

  it('treats empty strings as unset and fails fast without a key for anthropic', () => {
    expect(() => loadConfig({ LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: '' })).toThrow(/ANTHROPIC_API_KEY/);
    expect(loadConfig({ LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k' }).LLM_PROVIDER).toBe('anthropic');
  });

  it('rejects an unknown provider', () => {
    expect(() => loadConfig({ LLM_PROVIDER: 'x' })).toThrow(/LLM_PROVIDER/);
  });
});
