import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { APP_CONFIG } from './modules/config/config.module';
import { loadConfig } from './modules/config/config.schema';
import { LLM_PROVIDER, type LlmEvent, type LlmProvider, type LlmRequest } from './modules/llm/llm-provider';

type Block = LlmRequest['messages'][number]['content'][number];

const isToolResult = (b: Block | undefined): b is Extract<Block, { type: 'tool_result' }> => b?.type === 'tool_result';

/** Like the real API: every tool_use must be answered by a tool_result in the very next message. */
function assertToolCallsAnswered(messages: LlmRequest['messages']): void {
  messages.forEach((m, i) => {
    const calls = m.content.filter((b) => b.type === 'tool_use').map((b) => b.id);
    const answered = new Set(messages[i + 1]?.content.filter(isToolResult).map((b) => b.tool_use_id));
    if (calls.some((id) => !answered.has(id))) throw new Error('tool_use without tool_result');
  });
}

/**
 * Fake model, no network. Echoes the last user message in chunks; `/error` fails mid-stream.
 * Scripted tool turns: `/tools` (get_current_datetime + find_words in parallel, then add_words with the
 * returned date), `/badtool` (add_words with an invalid date) and `/loop` (asks for a tool forever).
 */
function fakeLlm(delayMs: number): LlmProvider {
  const say = async function* (text: string, signal: AbortSignal): AsyncGenerator<LlmEvent> {
    for (const word of text.split(/(?<=\s)/)) {
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
      if (signal.aborted) return;
      yield { type: 'text_delta', text: word };
    }
  };
  const call = (id: string, name: string, input: unknown): LlmEvent => ({
    type: 'tool_use',
    blocks: [{ type: 'tool_use', id, name, input }],
  });

  return {
    async *stream(request, signal) {
      assertToolCallsAnswered(request.messages);
      const lastText = request.messages.findLastIndex((m) => m.role === 'user' && m.content[0]?.type === 'text');
      const first = request.messages[lastText]?.content[0];
      const input = first?.type === 'text' ? first.text : '';
      // tool rounds already done for this user message: one result message per round
      const rounds = request.messages.slice(lastText + 1).filter((m) => m.content.some(isToolResult));
      const results = rounds.flatMap((m) => m.content.filter(isToolResult));

      if (input.startsWith('/tools') && rounds.length < 2) {
        if (rounds.length === 0) {
          yield* say('Checking. ', signal);
          yield {
            type: 'tool_use',
            blocks: [
              { type: 'tool_use', id: 'call_1', name: 'get_current_datetime', input: {} },
              { type: 'tool_use', id: 'call_2', name: 'find_words', input: { words: ['lucid'] } },
            ],
          };
        } else {
          const date = (JSON.parse(results[0]?.content ?? '{}') as { date: string }).date;
          yield call('call_3', 'add_words', { entries: [{ word: 'lucid', translation: 'ясний', addedAt: date }] });
        }
        return;
      }
      if (input.startsWith('/badtool') && rounds.length === 0) {
        yield call('call_1', 'add_words', { entries: [{ word: 'x', translation: 'y', addedAt: 'yesterday' }] });
        return;
      }
      if (input.startsWith('/loop')) {
        yield call(`call_${rounds.length}`, 'get_current_datetime', {});
        return;
      }

      yield* say(rounds.length > 0 ? `Tools said: ${results.map((r) => r.content).join(' | ')}` : `You said: ${input}`, signal);
      if (signal.aborted) return;
      yield input.startsWith('/error')
        ? { type: 'error', code: 'provider_error', message: 'Fake failure' }
        : { type: 'message_done', stopReason: 'end_turn' };
    },
  };
}

/** Full app with a fake provider — no network, no .env. */
export async function createTestApp(delayMs = 0): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(APP_CONFIG)
    .useValue(loadConfig({ ANTHROPIC_API_KEY: 'test', DICTIONARY_FILE: join(mkdtempSync(join(tmpdir(), 'dict-')), 'dictionary.json') }))
    .overrideProvider(LLM_PROVIDER)
    .useValue(fakeLlm(delayMs))
    .compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  await app.init();
  return app;
}
