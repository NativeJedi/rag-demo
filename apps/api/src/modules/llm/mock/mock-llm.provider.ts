import type { ChatEvent } from '@chatbot/shared';
import type { LlmProvider, LlmRequest, LlmResult } from '../llm-provider';
import { pickScenario } from './scenarios';

function lastUserText(request: LlmRequest): string {
  for (let i = request.messages.length - 1; i >= 0; i--) {
    const message = request.messages[i];
    if (message?.role !== 'user') continue;
    const text = message.blocks.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n');
    if (text) return text;
  }
  return '';
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0 || signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', done, { once: true });
  });
}

/** Scripted provider for UI work and tests: no network, no API key. */
export class MockLlmProvider implements LlmProvider {
  constructor(private readonly delayMs = 20) {}

  async *stream(request: LlmRequest, signal: AbortSignal): AsyncGenerator<ChatEvent> {
    const events = pickScenario(lastUserText(request))({ input: lastUserText(request), modelId: request.modelId });
    for (const event of events) {
      await sleep(event.type === 'message_start' ? this.delayMs * 3 : this.delayMs, signal);
      if (signal.aborted) return; // ends silently; ChatService records the abort
      yield event;
    }
  }

  async complete(request: LlmRequest): Promise<LlmResult> {
    const text = `Mock completion for: ${lastUserText(request).slice(0, 60)}`;
    return { text, usage: { inputTokens: 10, outputTokens: 8 }, stopReason: 'end_turn' };
  }
}
