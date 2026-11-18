import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { APP_CONFIG } from './modules/config/config.module';
import { loadConfig } from './modules/config/config.schema';
import { LLM_PROVIDER, type LlmProvider } from './modules/llm/llm-provider';

/** Echoes the last user message in chunks; `/error` fails mid-stream. No network. */
function fakeLlm(delayMs: number): LlmProvider {
  return {
    complete: async (request) => `You said: ${request.messages.at(-1)?.content ?? ''}`,
    async *stream(request, signal) {
      const input = request.messages.at(-1)?.content ?? '';
      for (const word of `You said: ${input}`.split(/(?<=\s)/)) {
        if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
        if (signal.aborted) return;
        yield { type: 'text_delta', text: word };
      }
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
    .useValue(loadConfig({ ANTHROPIC_API_KEY: 'test' }))
    .overrideProvider(LLM_PROVIDER)
    .useValue(fakeLlm(delayMs))
    .compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  await app.init();
  return app;
}
