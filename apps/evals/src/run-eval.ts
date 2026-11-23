import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '@chatbot/api/src/app.module';
import { LLM_PROVIDER, type LlmProvider } from '@chatbot/api/src/modules/llm/llm-provider';
import { loadDataset } from './dataset/dataset-file';
import { Evaluator } from './evaluation/evaluator';
import { buildReport, formatReport, saveReport } from './evaluation/report';
import { AnthropicEvalLlm } from './llm/eval-llm';
import { loadDotEnv } from './utils/load-env';

const EVALS_ROOT = join(__dirname, '..');
const JUDGE_PROMPT_FILE = join(EVALS_ROOT, 'prompts', 'judge.md');
const RESULTS_DIR = join(EVALS_ROOT, 'results');
const PROMPTS_DIR = join(EVALS_ROOT, '..', 'api', 'prompts');

async function main(): Promise<void> {
  loadDotEnv();
  // the prompt under test (shell or .env, so only after loadDotEnv); the chat provider reads the same variable from the config
  const promptName = process.env.SYSTEM_PROMPT_FILE || 'system.md';
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  try {
    const evaluator = new Evaluator(
      app.get<LlmProvider>(LLM_PROVIDER),
      new AnthropicEvalLlm(),
      readFileSync(JUDGE_PROMPT_FILE, 'utf8'),
    );
    const run = await evaluator.evaluate(loadDataset());

    const report = buildReport(readFileSync(join(PROMPTS_DIR, promptName), 'utf8').trim(), run);
    console.log(formatReport(report));
    console.log(`\nSaved ${saveReport(report, RESULTS_DIR)}`);
  } finally {
    await app.close();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
