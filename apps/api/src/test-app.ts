import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { LLM_PROVIDER } from './modules/llm/llm-provider';
import { MockLlmProvider } from './modules/llm/mock/mock-llm.provider';

/** Full app with the mock provider at zero delay — no network, no .env. */
export async function createTestApp(delayMs = 0): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(LLM_PROVIDER)
    .useValue(new MockLlmProvider(delayMs))
    .compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  await app.init();
  return app;
}
