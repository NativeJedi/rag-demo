import { start, textDeltas, type Scenario } from './helpers';

export const errorScenario: Scenario = (ctx) => [
  start(ctx),
  ...textDeltas('Starting to answer, but something is about to go wrong'),
  { type: 'error', code: 'mock_error', message: 'Simulated upstream failure (overloaded).', retryable: true },
];
