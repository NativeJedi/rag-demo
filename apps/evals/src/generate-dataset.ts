import 'reflect-metadata';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '@chatbot/api/src/app.module';
import { LLM_PROVIDER, type LlmProvider } from '@chatbot/api/src/modules/llm/llm-provider';
import { loadDotEnv } from './env';
import { generateCases } from './generate-cases';

const promptPath = join(__dirname, '..', 'prompts', 'generate-dataset.md');

async function main(): Promise<void> {
  loadDotEnv();
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const cases = await generateCases(app.get<LlmProvider>(LLM_PROVIDER), readFileSync(promptPath, 'utf8'));
  const out = join(__dirname, '..', 'dataset.json');
  writeFileSync(out, `${JSON.stringify(cases, null, 2)}\n`);
  console.log(`Wrote ${cases.length} cases to ${out}`);
  await app.close();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
