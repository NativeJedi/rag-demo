import { existsSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..');

/** Loads the repo-root .env (ANTHROPIC_API_KEY), regardless of the directory the process was started from. */
export function loadDotEnv(): void {
  const file = join(REPO_ROOT, '.env');
  if (existsSync(file)) process.loadEnvFile(file);
}
