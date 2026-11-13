import type { ChatEvent, StopReason } from '@chatbot/shared';

export interface ScenarioContext {
  input: string;
  modelId: string;
}

export type Scenario = (ctx: ScenarioContext) => ChatEvent[];

/** Split text into small deltas (whitespace-preserving) to mimic token streaming. */
export function textDeltas(text: string, wordsPerChunk = 2): ChatEvent[] {
  const parts = text.match(/\S+\s*|\s+/g) ?? [];
  const events: ChatEvent[] = [];
  for (let i = 0; i < parts.length; i += wordsPerChunk) {
    events.push({ type: 'text_delta', text: parts.slice(i, i + wordsPerChunk).join('') });
  }
  return events;
}

export function thinkingDeltas(text: string): ChatEvent[] {
  return textDeltas(text, 3).map((e) => (e.type === 'text_delta' ? { type: 'thinking_delta', text: e.text } : e));
}

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function start(ctx: ScenarioContext): ChatEvent {
  return { type: 'message_start', messageId: 'msg_mock', model: ctx.modelId };
}

export function finish(ctx: ScenarioContext, output: string, stopReason: StopReason = 'end_turn'): ChatEvent[] {
  return [
    { type: 'usage', inputTokens: estimateTokens(ctx.input) + 12, outputTokens: estimateTokens(output) },
    { type: 'message_done', stopReason },
  ];
}
