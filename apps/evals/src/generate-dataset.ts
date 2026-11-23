import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadDotEnv } from './env';
import { AnthropicEvalLlm } from './eval-llm';
import { generateCases } from './generate-cases';

const promptPath = join(__dirname, '..', 'prompts', 'generate-dataset.md');

async function main(): Promise<void> {
  loadDotEnv();
  const cases = await generateCases(new AnthropicEvalLlm(), readFileSync(promptPath, 'utf8'));
  const out = join(__dirname, '..', 'dataset.json');
  writeFileSync(out, `${JSON.stringify(cases, null, 2)}\n`);
  console.log(`Wrote ${cases.length} cases to ${out}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
