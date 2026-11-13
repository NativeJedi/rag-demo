import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// src/modules/chat and dist/modules/chat are both three levels below apps/api
const PROMPTS_DIR = join(__dirname, '..', '..', '..', 'prompts');
const cache = new Map<string, string>();

export function loadPrompt(name: string): string {
  let prompt = cache.get(name);
  if (prompt === undefined) {
    prompt = readFileSync(join(PROMPTS_DIR, `${name}.md`), 'utf8').trim();
    cache.set(name, prompt);
  }
  return prompt;
}
