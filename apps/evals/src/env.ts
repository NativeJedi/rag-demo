import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** Repo-root .env, regardless of the directory the process was started from. */
export function loadDotEnv(): void {
  const file = join(__dirname, '..', '..', '..', '.env');
  if (existsSync(file)) process.loadEnvFile(file);
}
