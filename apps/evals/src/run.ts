import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '@chatbot/api/src/app.module';
import { LLM_PROVIDER, type LlmProvider } from '@chatbot/api/src/modules/llm/llm-provider';
import { DatasetSchema } from './dataset';
import { loadDotEnv } from './env';
import { runCases } from './runner';

async function main(): Promise<void> {
  loadDotEnv();
  const cases = DatasetSchema.parse(JSON.parse(readFileSync(join(__dirname, '..', 'dataset.json'), 'utf8')));

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const llm = app.get<LlmProvider>(LLM_PROVIDER);

  // the provider owns the system prompt, so a bare completion is exactly what we want to test
  const reply = (input: string): Promise<string> => llm.complete({ messages: [{ role: 'user', content: input }] });

  const results = await runCases(cases, reply);
  for (const r of results) {
    console.log(`${r.case.id}: ${r.error ? `ERROR ${r.error}` : `${r.reply.split(/\s+/).length} words`}`);
  }
  await app.close();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
