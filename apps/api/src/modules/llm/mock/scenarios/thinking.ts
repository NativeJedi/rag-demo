import { finish, start, textDeltas, thinkingDeltas, type Scenario } from './helpers';

export const thinkingScenario: Scenario = (ctx) => {
  const thinking =
    'The user wants to see extended thinking. First I should consider what a good demonstration looks like. ' +
    'A short reasoning trace, followed by a concise answer, is enough. Let me check the arithmetic: 17 * 24 = 408.';
  const text = 'After thinking it through: **17 × 24 = 408**.\n\nThe reasoning above was collapsible.';
  return [start(ctx), ...thinkingDeltas(thinking), ...textDeltas(text), ...finish(ctx, thinking + text)];
};
