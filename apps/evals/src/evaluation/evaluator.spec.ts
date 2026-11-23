import { describe, expect, it } from 'vitest';
import type { LlmProvider } from '@chatbot/api/src/modules/llm/llm-provider';
import type { ChatEvent } from '@chatbot/shared';
import type { Case } from '../dataset/case';
import type { EvalLlm } from '../llm/eval-llm';
import { Evaluator } from './evaluator';

const testCase = (id: string, input = 'hi'): Case => ({ id, category: 'x', input, criteria: ['c'] });

/** Chat stub: the events to stream per input; throws for inputs it does not know. */
const chat = (eventsByInput: Record<string, ChatEvent[]>): LlmProvider => ({
  stream: async function* (request) {
    const events = eventsByInput[request.messages[0]?.content ?? ''];
    if (!events) throw new Error('provider down');
    yield* events;
  },
});

const textReply = (text: string): ChatEvent[] => [
  { type: 'text_delta', text },
  { type: 'message_done', stopReason: 'end_turn' },
];

const judge = (score: number): EvalLlm => ({
  completeJson: async (_request, schema) => schema.parse({ score, reasoning: 'r' }),
});

const evaluator = (events: Record<string, ChatEvent[]>, judgeScore = 10) => new Evaluator(chat(events), judge(judgeScore), '');

describe('Evaluator', () => {
  it('joins the text deltas into the reply', async () => {
    const events: ChatEvent[] = [
      { type: 'text_delta', text: 'Nice. Ready ' },
      { type: 'text_delta', text: 'for more?' },
      { type: 'message_done', stopReason: 'end_turn' },
    ];
    const { cases: [report] } = await evaluator({ hi: events }).evaluate([testCase('a-1')]);
    expect(report?.reply).toBe('Nice. Ready for more?');
  });

  it('rounds the mean of the judge score and the code score', async () => {
    // code checks: all pass (10); judge: 7 -> mean 8.5 -> 9
    const { cases: [report] } = await evaluator({ hi: textReply('Nice. Ready for more?') }, 7).evaluate([testCase('a-1')]);
    expect(report).toMatchObject({ id: 'a-1', category: 'x', score: 9 });
    expect(report?.evaluations.map((e) => [e.name, e.score])).toEqual([['model', 7], ['code', 10]]);
  });

  it('pulls the score down when code checks fail', async () => {
    // code: only the length check passes -> 10/3; (10 + 3.33) / 2 = 6.67 -> 7
    const { cases: [report] } = await evaluator({ hi: textReply('Sure! Use the past simple.') }, 10).evaluate([testCase('a-1')]);
    expect(report?.evaluations[1]?.score).toBeCloseTo(10 / 3);
    expect(report?.score).toBe(7);
  });

  it('rounds the average of the case scores', async () => {
    // case a: judge 10 + code 10 -> 10; case b: code 10/3 (no question, filler) -> 7; average 8.5 -> 9
    const { average } = await evaluator({ a: textReply('Fine?'), b: textReply('Sure thing') }).evaluate([testCase('a', 'a'), testCase('b', 'b')]);
    expect(average).toBe(9);
  });

  it('aborts on an error event', async () => {
    const events: ChatEvent[] = [{ type: 'error', code: 'provider_error', message: 'down' }];
    await expect(evaluator({ hi: events }).evaluate([testCase('a-1')])).rejects.toThrow('down');
  });

  it('aborts on the first provider error', async () => {
    const run = evaluator({ ok: textReply('Fine?') }).evaluate([testCase('a', 'ok'), testCase('b', 'boom')]);
    await expect(run).rejects.toThrow('provider down');
  });
});
