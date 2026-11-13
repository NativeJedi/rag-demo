import { citationsScenario } from './citations';
import { defaultScenario } from './default';
import { errorScenario } from './error';
import type { Scenario } from './helpers';
import { longScenario } from './long';
import { thinkingScenario } from './thinking';
import { toolsScenario } from './tools';

export const SCENARIOS = {
  thinking: thinkingScenario,
  tools: toolsScenario,
  citations: citationsScenario,
  long: longScenario,
  error: errorScenario,
} as const satisfies Record<string, Scenario>;

export type ScenarioName = keyof typeof SCENARIOS;

/** `/mock <name>` selects a scenario; anything else (or an unknown name) echoes. */
export function pickScenario(input: string): Scenario {
  const name = /^\s*\/mock\s+(\w+)/i.exec(input)?.[1]?.toLowerCase();
  if (name && name in SCENARIOS) return SCENARIOS[name as ScenarioName];
  return defaultScenario;
}
