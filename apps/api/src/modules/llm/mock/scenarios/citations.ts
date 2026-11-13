import { finish, start, textDeltas, type Scenario } from './helpers';

export const citationsScenario: Scenario = (ctx) => {
  const text =
    'The Messages API is stateless, so every request must carry the full conversation history. ' +
    'Streaming responses arrive as server-sent events.';
  return [
    start(ctx),
    ...textDeltas(text),
    {
      type: 'citation',
      citedText: 'The Messages API is stateless: send the whole conversation each time.',
      source: { kind: 'web', title: 'Messages API overview', ref: 'https://docs.claude.com/en/api/messages' },
      blockIndex: 0,
    },
    {
      type: 'citation',
      citedText: 'Set stream to true to receive incremental server-sent events.',
      source: { kind: 'document', title: 'Streaming guide (p. 2)', ref: 'doc_mock_streaming' },
      blockIndex: 0,
    },
    ...finish(ctx, text),
  ];
};
