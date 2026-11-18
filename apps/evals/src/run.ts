import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '@chatbot/api/src/app.module';
import { LLM_PROVIDER, type LlmProvider } from '@chatbot/api/src/modules/llm/llm-provider';
import { codeChecks } from './code-graders';
import { DatasetSchema } from './dataset';
import { loadDotEnv } from './env';
import { judgeCriteria } from './judge';
import { buildReport, formatReport, saveReport } from './report';
import { runCases } from './runner';

const systemPromptFile = join(__dirname, '..', '..', 'api', 'prompts', 'system.md');
const judgePrompt = readFileSync(join(__dirname, '..', 'prompts', 'judge.md'), 'utf8');

async function main(): Promise<void> {
  loadDotEnv();
  const cases = DatasetSchema.parse(JSON.parse(readFileSync(join(__dirname, '..', 'dataset.json'), 'utf8')));

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const llm = app.get<LlmProvider>(LLM_PROVIDER);

  // the provider owns the system prompt, so a bare completion is exactly what we want to test
  const reply = (input: string): Promise<string> => llm.complete({ messages: [{ role: 'user', content: input }] });

  const results = await runCases(cases, reply);
  const graded = [];
  for (const r of results) {
    const checks = [...codeChecks(r.reply), ...(await judgeCriteria(llm, judgePrompt, r))];
    graded.push({ id: r.case.id, category: r.case.category, checks });
  }

  const report = buildReport(readFileSync(systemPromptFile, 'utf8').trim(), graded);
  console.log(formatReport(report));
  console.log(`\nSaved ${saveReport(report, join(__dirname, '..', 'results'))}`);
  await app.close();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
