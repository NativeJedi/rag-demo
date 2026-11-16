import type { ChatEvent } from '@chatbot/shared';
import type { LlmProvider, LlmRequest } from '../llm-provider';

/**
 * Scripted provider for UI work and tests: no network, no API key.
 * It echoes the last user message word by word; `/error` makes the turn fail mid-stream.
 */
export class MockLlmProvider implements LlmProvider {
  /** Slow enough that streaming is visible and the Stop button is reachable. */
  constructor(private readonly delayMs = 60) {}

  async *stream(request: LlmRequest, signal: AbortSignal): AsyncGenerator<ChatEvent> {
    const input = request.messages.at(-1)?.content ?? '';
    const reply = input.startsWith('/error') ? 'Starting to answer, then failing…' : replyTo(input);

    for (const word of reply.split(/(?<=\s)/)) {
      await sleep(this.delayMs, signal);
      if (signal.aborted) return; // ends silently; ChatService records the abort
      yield { type: 'text_delta', text: word };
    }

    yield input.startsWith('/error')
      ? { type: 'error', code: 'provider_error', message: 'Mock failure' }
      : { type: 'message_done', stopReason: 'end_turn' };
  }
}

function replyTo(input: string): string {
  return [
    `You said: **${input.slice(0, 200)}**`,
    '',
    'This is the mock provider, so the answer is scripted. It streams one word at a time, which is enough to see the SSE transport, the reducer and the Stop button work.',
    '',
    'Send `/error` to see the error path.',
  ].join('\n');
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
