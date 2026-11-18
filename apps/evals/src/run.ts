import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '@chatbot/api/src/app.module';
import { LLM_PROVIDER, type LlmProvider } from '@chatbot/api/src/modules/llm/llm-provider';
import { codeChecks } from './code-graders';
import { DatasetSchema } from './dataset';
import { loadDotEnv } from './env';
import { type Check, score } from './grade';
import { judgeCriteria } from './judge';
import { runCases } from './runner';

const judgePrompt = readFileSync(join(__dirname, '..', 'prompts', 'judge.md'), 'utf8');

async function main(): Promise<void> {
  loadDotEnv();
  const cases = DatasetSchema.parse(JSON.parse(readFileSync(join(__dirname, '..', 'dataset.json'), 'utf8')));

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const llm = app.get<LlmProvider>(LLM_PROVIDER);

  // the provider owns the system prompt, so a bare completion is exactly what we want to test
  const reply = (input: string): Promise<string> => llm.complete({ messages: [{ role: 'user', content: input }] });

  const results = await runCases(cases, reply);
  for (const r of results) {
    const checks: Check[] = r.error
      ? [{ name: 'tutor replied', passed: false, reason: r.error }]
      : [...codeChecks(r.reply), ...(await judgeCriteria(llm, judgePrompt, r))];
    console.log(`${r.case.id}: ${score(checks).toFixed(2)}`);
    for (const c of checks.filter((c) => !c.passed)) console.log(`  FAIL ${c.name}${c.reason ? ` (${c.reason})` : ''}`);
  }
  await app.close();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
