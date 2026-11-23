import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATASET_FILE, saveDataset } from './dataset/dataset-file';
import { DatasetGenerator } from './dataset/dataset-generator';
import { AnthropicEvalLlm } from './llm/eval-llm';
import { loadDotEnv } from './utils/load-env';

const PROMPT_FILE = join(__dirname, '..', 'prompts', 'generate-dataset.md');

async function main(): Promise<void> {
  loadDotEnv();
  const generator = new DatasetGenerator(new AnthropicEvalLlm(), readFileSync(PROMPT_FILE, 'utf8'));
  const cases = await generator.generate();
  saveDataset(cases);
  console.log(`Wrote ${cases.length} cases to ${DATASET_FILE}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
