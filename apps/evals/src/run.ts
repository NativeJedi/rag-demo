import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '@chatbot/api/src/app.module';
import { LLM_PROVIDER, type LlmProvider } from '@chatbot/api/src/modules/llm/llm-provider';
import { DatasetSchema } from './dataset';
import { loadDotEnv } from './env';
import { AnthropicEvalLlm } from './eval-llm';
import { gradeCase } from './grade';
import { buildReport, formatReport, saveReport } from './report';
import { collectReply, runCases } from './runner';

const systemPromptFile = join(__dirname, '..', '..', 'api', 'prompts', 'system.md');
const judgePrompt = readFileSync(join(__dirname, '..', 'prompts', 'judge.md'), 'utf8');

async function main(): Promise<void> {
  loadDotEnv();
  const cases = DatasetSchema.parse(JSON.parse(readFileSync(join(__dirname, '..', 'dataset.json'), 'utf8')));

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const chat = app.get<LlmProvider>(LLM_PROVIDER);
  const judgeLlm = new AnthropicEvalLlm();

  const results = await runCases(cases, (input) => collectReply(chat, input));
  const graded = [];
  for (const r of results) graded.push({ ...(await gradeCase(judgeLlm, judgePrompt, r)), reply: r.reply });

  const report = buildReport(readFileSync(systemPromptFile, 'utf8').trim(), graded);
  console.log(formatReport(report));
  console.log(`\nSaved ${saveReport(report, join(__dirname, '..', 'results'))}`);
  await app.close();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
