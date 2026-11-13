import type { Usage } from '@chatbot/shared';

export function formatTokens(n: number): string {
  return n >= 10_000 ? `${(n / 1000).toFixed(0)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

export function sumUsage(usages: (Usage | undefined)[]): Usage {
  return usages.reduce<Usage>(
    (acc, u) => ({
      inputTokens: acc.inputTokens + (u?.inputTokens ?? 0),
      outputTokens: acc.outputTokens + (u?.outputTokens ?? 0),
      cacheReadTokens: (acc.cacheReadTokens ?? 0) + (u?.cacheReadTokens ?? 0),
      cacheWriteTokens: (acc.cacheWriteTokens ?? 0) + (u?.cacheWriteTokens ?? 0),
    }),
    { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
  );
}

export function prettyJson(value: unknown): string {
  return typeof value === 'string' ? value : (JSON.stringify(value, null, 2) ?? '');
}
